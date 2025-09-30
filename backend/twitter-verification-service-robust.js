// ==================================================
// 🚀 ROBUST TWITTER VERIFICATION SERVICE
// Perfect retweet and X post detection
// ==================================================

const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
console.log('🔍 Loading .env from:', envPath);
require('dotenv').config({ path: envPath });

// Configure Puppeteer with stealth
puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.TWITTER_PORT || 3002;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Configuration
const CONFIG = {
  TWITTER_BASE_URL: 'https://x.com',
  RETWEET_TARGET: 'https://x.com/neftitxyz/status/1937138311593656686',
  RETWEET_TARGET_ID: '1937138311593656686',
  KEYWORDS: ['join neftit', 'neftit', 'NEFTIT'],
  TIMEOUT: 30000,
  MAX_RETRIES: 3,
  CACHE_DURATION: 10 * 60 * 1000, // 10 minutes
  USER_AGENTS: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ]
};

// Health monitoring
let healthStats = {
  status: 'healthy',
  startTime: Date.now(),
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  lastError: null,
  uptime: () => Math.floor((Date.now() - healthStats.startTime) / 1000)
};

// Cache for results
const cache = new Map();

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Cache management
function getCachedResult(key) {
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expires) {
    console.log(`📋 Using cached result for: ${key}`);
    return cached.data;
  }
  if (cached) {
    cache.delete(key);
  }
  return null;
}

function setCachedResult(key, data) {
  cache.set(key, {
    data,
    expires: Date.now() + CONFIG.CACHE_DURATION
  });
  console.log(`💾 Cached result for: ${key}`);
}

// Enhanced Puppeteer browser management
let browser = null;
let browserStartTime = 0;

async function getBrowser() {
  const now = Date.now();
  
  // Restart browser every 30 minutes to prevent detection
  if (!browser || (now - browserStartTime) > 30 * 60 * 1000) {
    if (browser) {
      console.log('🔄 Restarting browser to prevent detection...');
      await browser.close();
    }
    
    console.log('🚀 Starting new browser instance...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-timer-indexing',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript',
        '--disable-css',
        '--disable-fonts',
        '--disable-media',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--window-size=1920,1080'
      ]
    });
    
    browserStartTime = now;
    console.log('✅ Browser started successfully');
  }
  
  return browser;
}

// Enhanced retweet detection
async function detectRetweet(username, targetTweetId) {
  console.log(`🔍 Detecting retweet for user: ${username}, tweet: ${targetTweetId}`);
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    // Set random user agent
    const userAgent = CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)];
    await page.setUserAgent(userAgent);
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media', 'script'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Navigate to user's profile
    const profileUrl = `https://x.com/${username}`;
    console.log(`📍 Navigating to: ${profileUrl}`);
    
    await page.goto(profileUrl, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.TIMEOUT
    });
    
    // Wait for tweets to load
    await page.waitForSelector('[data-testid="tweet"]', { timeout: 15000 });
    
    // Get all tweets
    const tweets = await page.evaluate((targetId) => {
      const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
      const results = [];
      
      for (const tweet of tweetElements) {
        try {
          // Check if this is a retweet
          const retweetIndicator = tweet.querySelector('[data-testid="socialContext"]');
          if (retweetIndicator && retweetIndicator.textContent.includes('Retweeted')) {
            // Get tweet link
            const tweetLink = tweet.querySelector('a[href*="/status/"]');
            if (tweetLink) {
              const href = tweetLink.getAttribute('href');
              const tweetId = href.split('/status/')[1]?.split('?')[0];
              
              if (tweetId === targetId) {
                results.push({
                  type: 'retweet',
                  tweetId: tweetId,
                  isTargetRetweet: true,
                  text: tweet.textContent || 'Retweet detected'
                });
              }
            }
          }
        } catch (e) {
          // Continue to next tweet
        }
      }
      
      return results;
    }, targetTweetId);
    
    console.log(`📊 Found ${tweets.length} matching retweets`);
    
    // Check if any of the retweets match our target
    const hasRetweeted = tweets.some(tweet => tweet.isTargetRetweet);
    
    return {
      success: true,
      hasRetweeted,
      retweets: tweets,
      username,
      targetTweetId,
      profileUrl
    };
    
  } catch (error) {
    console.error('❌ Retweet detection error:', error.message);
    throw error;
  } finally {
    await page.close();
  }
}

// Enhanced X post detection
async function detectXPost(username, keywords) {
  console.log(`🔍 Detecting X posts for user: ${username}, keywords: ${keywords.join(', ')}`);
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    // Set random user agent
    const userAgent = CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)];
    await page.setUserAgent(userAgent);
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media', 'script'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Navigate to user's profile
    const profileUrl = `https://x.com/${username}`;
    console.log(`📍 Navigating to: ${profileUrl}`);
    
    await page.goto(profileUrl, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.TIMEOUT
    });
    
    // Wait for tweets to load
    await page.waitForSelector('[data-testid="tweet"]', { timeout: 15000 });
    
    // Get all tweets and check for keywords
    const matchingPosts = await page.evaluate((searchKeywords) => {
      const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
      const results = [];
      
      for (const tweet of tweetElements) {
        try {
          const tweetText = tweet.textContent || '';
          const lowerText = tweetText.toLowerCase();
          
          // Check if any keyword is present
          for (const keyword of searchKeywords) {
            if (lowerText.includes(keyword.toLowerCase())) {
              // Get tweet link
              const tweetLink = tweet.querySelector('a[href*="/status/"]');
              if (tweetLink) {
                const href = tweetLink.getAttribute('href');
                const tweetId = href.split('/status/')[1]?.split('?')[0];
                
                results.push({
                  type: 'post',
                  tweetId: tweetId,
                  text: tweetText,
                  keyword: keyword,
                  href: href
                });
              }
              break; // Found a match, no need to check other keywords
            }
          }
        } catch (e) {
          // Continue to next tweet
        }
      }
      
      return results;
    }, keywords);
    
    console.log(`📊 Found ${matchingPosts.length} matching posts`);
    
    return {
      success: true,
      hasPosted: matchingPosts.length > 0,
      posts: matchingPosts,
      username,
      keywords,
      profileUrl
    };
    
  } catch (error) {
    console.error('❌ X post detection error:', error.message);
    throw error;
  } finally {
    await page.close();
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    success: true,
    message: 'Twitter verification service is running',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(healthStats.uptime() / 3600)}h ${Math.floor((healthStats.uptime() % 3600) / 60)}m ${healthStats.uptime() % 60}s`,
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
    },
    stats: healthStats,
    config: {
      twitterBaseUrl: CONFIG.TWITTER_BASE_URL,
      retweetTarget: CONFIG.RETWEET_TARGET,
      keywords: CONFIG.KEYWORDS,
      cacheSize: cache.size,
      browserActive: !!browser
    }
  });
});

// Retweet verification endpoint
app.post('/verify-retweet', async (req, res) => {
  try {
    const { twitterUsername, targetTweetId = CONFIG.RETWEET_TARGET_ID } = req.body;
    
    if (!twitterUsername) {
      healthStats.failedRequests++;
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: twitterUsername',
        error: 'MISSING_USERNAME'
      });
    }
    
    // Clean username (remove @ if present)
    const cleanUsername = twitterUsername.replace('@', '');
    
    // Check cache first
    const cacheKey = `retweet:${cleanUsername}:${targetTweetId}`;
    const cached = getCachedResult(cacheKey);
    if (cached) {
      healthStats.successfulRequests++;
      return res.json({
        ...cached,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`🔍 Verifying retweet for @${cleanUsername}`);
    
    const result = await detectRetweet(cleanUsername, targetTweetId);
    
    // Cache the result
    setCachedResult(cacheKey, result);
    
    healthStats.successfulRequests++;
    
    res.json({
      ...result,
      timestamp: new Date().toISOString(),
      cached: false
    });
    
  } catch (error) {
    healthStats.failedRequests++;
    healthStats.lastError = error.message;
    console.error('❌ Retweet verification error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to verify retweet',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// X post verification endpoint
app.post('/verify-tweet', async (req, res) => {
  try {
    const { twitterUsername, keywords = CONFIG.KEYWORDS } = req.body;
    
    if (!twitterUsername) {
      healthStats.failedRequests++;
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: twitterUsername',
        error: 'MISSING_USERNAME'
      });
    }
    
    // Clean username (remove @ if present)
    const cleanUsername = twitterUsername.replace('@', '');
    
    // Check cache first
    const cacheKey = `tweet:${cleanUsername}:${keywords.join(',')}`;
    const cached = getCachedResult(cacheKey);
    if (cached) {
      healthStats.successfulRequests++;
      return res.json({
        ...cached,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`🔍 Verifying X posts for @${cleanUsername}`);
    
    const result = await detectXPost(cleanUsername, keywords);
    
    // Cache the result
    setCachedResult(cacheKey, result);
    
    healthStats.successfulRequests++;
    
    res.json({
      ...result,
      timestamp: new Date().toISOString(),
      cached: false
    });
    
  } catch (error) {
    healthStats.failedRequests++;
    healthStats.lastError = error.message;
    console.error('❌ X post verification error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to verify X posts',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Batch verification endpoint (both retweet and X post)
app.post('/verify-twitter-batch', async (req, res) => {
  try {
    const { twitterUsername } = req.body;
    
    if (!twitterUsername) {
      healthStats.failedRequests++;
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: twitterUsername',
        error: 'MISSING_USERNAME'
      });
    }
    
    // Clean username (remove @ if present)
    const cleanUsername = twitterUsername.replace('@', '');
    
    // Check cache first
    const cacheKey = `batch:${cleanUsername}`;
    const cached = getCachedResult(cacheKey);
    if (cached) {
      healthStats.successfulRequests++;
      return res.json({
        ...cached,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`🔍 Batch verifying Twitter for @${cleanUsername}`);
    
    // Run both verifications in parallel
    const [retweetResult, tweetResult] = await Promise.all([
      detectRetweet(cleanUsername, CONFIG.RETWEET_TARGET_ID),
      detectXPost(cleanUsername, CONFIG.KEYWORDS)
    ]);
    
    const batchResult = {
      success: true,
      username: cleanUsername,
      retweet: {
        hasRetweeted: retweetResult.hasRetweeted,
        targetTweet: CONFIG.RETWEET_TARGET,
        details: retweetResult
      },
      xpost: {
        hasPosted: tweetResult.hasPosted,
        keywords: CONFIG.KEYWORDS,
        details: tweetResult
      },
      allTasksComplete: retweetResult.hasRetweeted && tweetResult.hasPosted
    };
    
    // Cache the result
    setCachedResult(cacheKey, batchResult);
    
    healthStats.successfulRequests++;
    
    res.json({
      ...batchResult,
      timestamp: new Date().toISOString(),
      cached: false,
      optimized: true
    });
    
  } catch (error) {
    healthStats.failedRequests++;
    healthStats.lastError = error.message;
    console.error('❌ Batch Twitter verification error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to verify Twitter tasks',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Cache management endpoints
app.post('/clear-cache', (req, res) => {
  const oldSize = cache.size;
  cache.clear();
  
  res.json({
    success: true,
    message: 'Cache cleared successfully',
    clearedEntries: oldSize,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  healthStats.failedRequests++;
  healthStats.lastError = error.message;
  console.error('💥 Unhandled error:', error);
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    availableEndpoints: [
      'POST /verify-retweet',
      'POST /verify-tweet',
      'POST /verify-twitter-batch',
      'GET /health',
      'POST /clear-cache'
    ],
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  healthStats.status = 'degraded';
  healthStats.lastError = error.message;
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  healthStats.status = 'degraded';
  healthStats.lastError = reason;
});

// Periodic cleanup
setInterval(() => {
  // Clean expired cache entries
  const now = Date.now();
  for (const [key, data] of cache.entries()) {
    if (now >= data.expires) {
      cache.delete(key);
    }
  }
  
  // Reset health status if no recent errors
  if (healthStats.status === 'degraded' && now - healthStats.startTime > 300000) {
    healthStats.status = 'healthy';
  }
}, 60000); // Run every minute

// Start server
const server = app.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 ROBUST TWITTER VERIFICATION SERVICE');
  console.log('========================================');
  console.log(`📍 Running on port: ${PORT}`);
  console.log(`🐦 Twitter Base URL: ${CONFIG.TWITTER_BASE_URL}`);
  console.log(`🔄 Retweet Target: ${CONFIG.RETWEET_TARGET}`);
  console.log(`🔑 Keywords: ${CONFIG.KEYWORDS.join(', ')}`);
  console.log(`⏰ Request Timeout: ${CONFIG.TIMEOUT / 1000}s`);
  console.log(`💾 Cache Duration: ${CONFIG.CACHE_DURATION / 1000}s`);
  console.log('');
  console.log('📋 Available endpoints:');
  console.log('   POST /verify-retweet');
  console.log('   POST /verify-tweet');
  console.log('   POST /verify-twitter-batch');
  console.log('   GET  /health');
  console.log('   POST /clear-cache');
  console.log('');
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log('========================================');
  console.log('✅ Service is ready and running!');
  console.log('🎯 Perfect Twitter detection enabled!');
  console.log('========================================');
});

// Handle server errors
server.on('error', (error) => {
  console.error('💥 Server error:', error);
  healthStats.status = 'error';
  healthStats.lastError = error.message;
  
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    process.exit(1);
  }
});

module.exports = app;
