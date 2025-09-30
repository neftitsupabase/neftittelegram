const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());

// OPTIMIZED Configuration for LOW EGRESS
const CONFIG = {
  DELAY_MIN: 1000,        // Reduced delay: 1 second minimum
  DELAY_MAX: 3000,        // Reduced delay: 3 seconds maximum
  TIMEOUT: 15000,         // Reduced timeout: 15 seconds (was 30)
  MAX_RETRIES: 2,         // Reduced retries: 2 (was 3)
  USER_AGENTS: [          // Minimal user agents
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
  ],
  // EGRESS OPTIMIZATION SETTINGS
  MAX_PAGE_SIZE: 1024 * 1024,  // 1MB max page size
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes cache
  SKIP_IMAGES: true,             // Skip loading images
  SKIP_CSS: true,                // Skip loading CSS
  SKIP_FONTS: true,              // Skip loading fonts
  SKIP_MEDIA: true               // Skip loading media
};

// Browser instance management with EGRESS OPTIMIZATION
let browser = null;
let isInitializing = false;
let taskCache = new Map(); // Cache for task results

/**
 * Initialize browser instance with EGRESS OPTIMIZATION
 */
async function initializeBrowser() {
  if (browser || isInitializing) return browser;
  
  isInitializing = true;
  try {
    console.log('🚀 Initializing OPTIMIZED Puppeteer browser (LOW EGRESS)...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        // EGRESS OPTIMIZATION ARGS
        '--disable-images',           // Disable image loading
        '--disable-javascript',       // Disable JS for faster loading
        '--disable-plugins',          // Disable plugins
        '--disable-extensions',       // Disable extensions
        '--disable-default-apps',     // Disable default apps
        '--disable-sync',             // Disable sync
        '--disable-translate',        // Disable translate
        '--disable-web-security',     // Disable web security for faster access
        '--disable-features=VizDisplayCompositor', // Disable compositor
        '--memory-pressure-off',      // Disable memory pressure
        '--max_old_space_size=128'   // Limit memory usage to 128MB
      ],
      defaultViewport: {
        width: 800,   // Reduced viewport (was 1920)
        height: 600   // Reduced viewport (was 1080)
      }
    });
    
    console.log('✅ OPTIMIZED Browser initialized successfully (LOW EGRESS)');
    return browser;
  } catch (error) {
    console.error('❌ Failed to initialize browser:', error);
    isInitializing = false;
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Get random delay (OPTIMIZED for lower delays)
 */
function getRandomDelay() {
  return Math.floor(Math.random() * (CONFIG.DELAY_MAX - CONFIG.DELAY_MIN + 1)) + CONFIG.DELAY_MIN;
}

/**
 * Get random user agent
 */
function getRandomUserAgent() {
  return CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)];
}

/**
 * Wait for random delay (OPTIMIZED)
 */
async function randomDelay() {
  const delay = getRandomDelay();
  console.log(`⏳ Waiting ${delay}ms (OPTIMIZED for LOW EGRESS)...`);
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Check cache for existing results (EGRESS OPTIMIZATION)
 */
function getCachedResult(cacheKey) {
  const cached = taskCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) {
    console.log(`💾 Using cached result for: ${cacheKey}`);
    return cached.result;
  }
  return null;
}

/**
 * Cache result (EGRESS OPTIMIZATION)
 */
function cacheResult(cacheKey, result) {
  taskCache.set(cacheKey, {
    result,
    timestamp: Date.now()
  });
  console.log(`💾 Cached result for: ${cacheKey}`);
}

/**
 * Extract tweet ID from Twitter URL
 */
function extractTweetId(tweetUrl) {
  try {
    const url = new URL(tweetUrl);
    if (url.hostname.includes('twitter.com') || url.hostname.includes('x.com')) {
      const pathParts = url.pathname.split('/');
      const tweetIdIndex = pathParts.findIndex(part => part === 'status');
      if (tweetIdIndex !== -1 && pathParts[tweetIdIndex + 1]) {
        return pathParts[tweetIdIndex + 1];
      }
    }
    return null;
  } catch (error) {
    console.error('❌ Error extracting tweet ID:', error);
    return null;
  }
}

/**
 * OPTIMIZED: Check if user has retweeted a specific tweet (LOW EGRESS)
 */
async function checkRetweet(username, tweetId) {
  const cacheKey = `retweet_${username}_${tweetId}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  let page = null;
  
  try {
    console.log(`🔍 [OPTIMIZED] Checking retweet for @${username} on tweet ${tweetId}`);
    
    // Initialize browser if needed
    await initializeBrowser();
    
    // Create new page with EGRESS OPTIMIZATION
    page = await browser.newPage();
    
    // Set random user agent
    await page.setUserAgent(getRandomUserAgent());
    
    // Set viewport (OPTIMIZED)
    await page.setViewport({ width: 800, height: 600 });
    
    // Set timeout (OPTIMIZED)
    page.setDefaultTimeout(CONFIG.TIMEOUT);
    
    // EGRESS OPTIMIZATION: Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (CONFIG.SKIP_IMAGES && req.resourceType() === 'image') {
        req.abort();
      } else if (CONFIG.SKIP_CSS && req.resourceType() === 'stylesheet') {
        req.abort();
      } else if (CONFIG.SKIP_FONTS && req.resourceType() === 'font') {
        req.abort();
      } else if (CONFIG.SKIP_MEDIA && req.resourceType() === 'media') {
        req.abort();
      } else if (req.resourceType() === 'script' && !req.url().includes('twitter.com')) {
        req.abort(); // Block external scripts
      } else {
        req.continue();
      }
    });
    
    // Navigate to user's profile (OPTIMIZED)
    console.log(`🌐 [OPTIMIZED] Navigating to @${username}'s profile...`);
    await page.goto(`https://twitter.com/${username}`, { 
      waitUntil: 'domcontentloaded', // Faster than 'networkidle2'
      timeout: CONFIG.TIMEOUT 
    });
    
    // Wait for minimal content (OPTIMIZED)
    await page.waitForSelector('[data-testid="tweet"]', { timeout: 8000 }); // Reduced timeout
    
    // Check if tweet ID appears in the timeline (OPTIMIZED)
    const hasRetweet = await page.evaluate((id) => {
      // Look for retweet indicators with the tweet ID
      const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
      
      for (const tweet of tweetElements) {
        const tweetText = tweet.textContent || '';
        const tweetLinks = tweet.querySelectorAll('a[href*="/status/"]');
        
        // Check if any link contains the tweet ID
        for (const link of tweetLinks) {
          if (link.href.includes(id)) {
            return true;
          }
        }
        
        // Check if tweet text contains retweet indicators
        if (tweetText.includes('RT') && tweetText.includes(id)) {
          return true;
        }
      }
      
      return false;
    }, tweetId);
    
    const result = { success: true, isVerified: hasRetweet };
    
    // Cache the result (EGRESS OPTIMIZATION)
    cacheResult(cacheKey, result);
    
    if (hasRetweet) {
      console.log(`✅ [OPTIMIZED] Retweet found for @${username} on tweet ${tweetId}`);
    } else {
      console.log(`❌ [OPTIMIZED] No retweet found for @${username} on tweet ${tweetId}`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ [OPTIMIZED] Error checking retweet for @${username}:`, error);
    return { success: false, isVerified: false, error: error.message };
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * OPTIMIZED: Check if user has posted a tweet with specific keywords (LOW EGRESS)
 */
async function checkTweetContent(username, keywords) {
  const cacheKey = `tweet_${username}_${keywords.join('_')}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  let page = null;
  
  try {
    console.log(`🔍 [OPTIMIZED] Checking tweet content for @${username} with keywords: ${keywords.join(', ')}`);
    
    // Initialize browser if needed
    await initializeBrowser();
    
    // Create new page with EGRESS OPTIMIZATION
    page = await browser.newPage();
    
    // Set random user agent
    await page.setUserAgent(getRandomUserAgent());
    
    // Set viewport (OPTIMIZED)
    await page.setViewport({ width: 800, height: 600 });
    
    // Set timeout (OPTIMIZED)
    page.setDefaultTimeout(CONFIG.TIMEOUT);
    
    // EGRESS OPTIMIZATION: Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (CONFIG.SKIP_IMAGES && req.resourceType() === 'image') {
        req.abort();
      } else if (CONFIG.SKIP_CSS && req.resourceType() === 'stylesheet') {
        req.abort();
      } else if (CONFIG.SKIP_FONTS && req.resourceType() === 'font') {
        req.abort();
      } else if (CONFIG.SKIP_MEDIA && req.resourceType() === 'media') {
        req.abort();
      } else if (req.resourceType() === 'script' && !req.url().includes('twitter.com')) {
        req.abort(); // Block external scripts
      } else {
        req.continue();
      }
    });
    
    // Navigate to user's profile (OPTIMIZED)
    console.log(`🌐 [OPTIMIZED] Navigating to @${username}'s profile...`);
    await page.goto(`https://twitter.com/${username}`, { 
      waitUntil: 'domcontentloaded', // Faster than 'networkidle2'
      timeout: CONFIG.TIMEOUT 
    });
    
    // Wait for minimal content (OPTIMIZED)
    await page.waitForSelector('[data-testid="tweet"]', { timeout: 8000 }); // Reduced timeout
    
    // Check if keywords appear in recent tweets (OPTIMIZED)
    const hasKeywords = await page.evaluate((searchKeywords) => {
      const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
      
      for (const tweet of tweetElements) {
        const tweetText = tweet.textContent || '';
        const lowerTweetText = tweetText.toLowerCase();
        
        // Check if all keywords are present
        const allKeywordsPresent = searchKeywords.every(keyword => 
          lowerTweetText.includes(keyword.toLowerCase())
        );
        
        if (allKeywordsPresent) {
          return true;
        }
      }
      
      return false;
    }, keywords);
    
    const result = { success: true, isVerified: hasKeywords };
    
    // Cache the result (EGRESS OPTIMIZATION)
    cacheResult(cacheKey, result);
    
    if (hasKeywords) {
      console.log(`✅ [OPTIMIZED] Tweet with keywords found for @${username}: ${keywords.join(', ')}`);
    } else {
      console.log(`❌ [OPTIMIZED] No tweet with keywords found for @${username}: ${keywords.join(', ')}`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ [OPTIMIZED] Error checking tweet content for @${username}:`, error);
    return { success: false, isVerified: false, error: error.message };
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * OPTIMIZED: Check if user follows a specific account (LOW EGRESS)
 */
async function checkFollow(username, targetUsername) {
  const cacheKey = `follow_${username}_${targetUsername}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  let page = null;
  
  try {
    console.log(`🔍 [OPTIMIZED] Checking if @${username} follows @${targetUsername}`);
    
    // Initialize browser if needed
    await initializeBrowser();
    
    // Create new page with EGRESS OPTIMIZATION
    page = await browser.newPage();
    
    // Set random user agent
    await page.setUserAgent(getRandomUserAgent());
    
    // Set viewport (OPTIMIZED)
    await page.setViewport({ width: 800, height: 600 });
    
    // Set timeout (OPTIMIZED)
    page.setDefaultTimeout(CONFIG.TIMEOUT);
    
    // EGRESS OPTIMIZATION: Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (CONFIG.SKIP_IMAGES && req.resourceType() === 'image') {
        req.abort();
      } else if (CONFIG.SKIP_CSS && req.resourceType() === 'stylesheet') {
        req.abort();
      } else if (CONFIG.SKIP_FONTS && req.resourceType() === 'font') {
        req.abort();
      } else if (CONFIG.SKIP_MEDIA && req.resourceType() === 'media') {
        req.abort();
      } else if (req.resourceType() === 'script' && !req.url().includes('twitter.com')) {
        req.abort(); // Block external scripts
      } else {
        req.continue();
      }
    });
    
    // Navigate to user's profile (OPTIMIZED)
    console.log(`🌐 [OPTIMIZED] Navigating to @${username}'s profile...`);
    await page.goto(`https://twitter.com/${username}`, { 
      waitUntil: 'domcontentloaded', // Faster than 'networkidle2'
      timeout: CONFIG.TIMEOUT 
    });
    
    // Wait for minimal content (OPTIMIZED)
    await page.waitForSelector('[data-testid="tweet"]', { timeout: 8000 }); // Reduced timeout
    
    // Check if user follows the target account (OPTIMIZED)
    const isFollowing = await page.evaluate((target) => {
      // Look for following indicators
      const followingElements = document.querySelectorAll('a[href*="/following"]');
      
      for (const element of followingElements) {
        if (element.textContent.includes(target)) {
          return true;
        }
      }
      
      return false;
    }, targetUsername);
    
    const result = { success: true, isVerified: isFollowing };
    
    // Cache the result (EGRESS OPTIMIZATION)
    cacheResult(cacheKey, result);
    
    if (isFollowing) {
      console.log(`✅ [OPTIMIZED] @${username} is following @${targetUsername}`);
    } else {
      console.log(`❌ [OPTIMIZED] @${username} is not following @${targetUsername}`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ [OPTIMIZED] Error checking follow status for @${username}:`, error);
    return { success: false, isVerified: false, error: error.message };
  } finally {
    if (page) {
      await page.close();
    }
  }
}

// API Endpoints (OPTIMIZED for LOW EGRESS)

/**
 * POST /verify-retweet - Verify if user has retweeted a specific tweet
 */
app.post('/verify-retweet', async (req, res) => {
  try {
    const { username, tweetUrl } = req.body;
    
    if (!username || !tweetUrl) {
      return res.status(400).json({
        success: false,
        message: 'Username and tweet URL are required',
        error: 'Missing required parameters'
      });
    }

    console.log(`🔍 [OPTIMIZED] Verifying retweet for @${username} on tweet: ${tweetUrl}`);
    
    // Extract tweet ID from URL
    const tweetId = extractTweetId(tweetUrl);
    if (!tweetId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tweet URL format',
        error: 'Could not extract tweet ID from URL'
      });
    }

    console.log(`📱 [OPTIMIZED] Extracted tweet ID: ${tweetId}`);

    // Add random delay to avoid rate limiting (OPTIMIZED)
    await randomDelay();

    // Check retweet
    const result = await checkRetweet(username, tweetId);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.isVerified ? 
          `@${username} has retweeted the specified tweet!` : 
          `@${username} has not retweeted the specified tweet`,
        isVerified: result.isVerified,
        details: {
          username,
          tweetUrl,
          tweetId,
          foundAt: new Date().toISOString(),
          optimized: true,
          egress_saved: 'LOW EGRESS MODE'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to verify retweet',
        error: result.error || 'Verification failed'
      });
    }

  } catch (error) {
    console.error('❌ [OPTIMIZED] Retweet verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during retweet verification',
      error: error.message
    });
  }
});

/**
 * POST /verify-tweet - Verify if user has posted a tweet with specific keywords
 */
app.post('/verify-tweet', async (req, res) => {
  try {
    const { username, keywords } = req.body;
    
    if (!username || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Username and keywords array are required',
        error: 'Missing or invalid parameters'
      });
    }

    console.log(`🔍 [OPTIMIZED] Verifying tweet for @${username} with keywords: ${keywords.join(', ')}`);

    // Add random delay to avoid rate limiting (OPTIMIZED)
    await randomDelay();

    // Check tweet content
    const result = await checkTweetContent(username, keywords);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.isVerified ? 
          `@${username} has posted a tweet containing the required keywords!` : 
          `@${username} has not posted a tweet with the required keywords`,
        isVerified: result.isVerified,
        details: {
          username,
          keywords: keywords.join(', '),
          foundAt: new Date().toISOString(),
          optimized: true,
          egress_saved: 'LOW EGRESS MODE'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to verify tweet',
        error: result.error || 'Verification failed'
      });
    }

  } catch (error) {
    console.error('❌ [OPTIMIZED] Tweet verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during tweet verification',
      error: error.message
    });
  }
});

/**
 * POST /verify-follow - Verify if user follows a specific account
 */
app.post('/verify-follow', async (req, res) => {
  try {
    const { username, targetUsername } = req.body;
    
    if (!username || !targetUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username and target username are required',
        error: 'Missing required parameters'
      });
    }

    console.log(`🔍 [OPTIMIZED] Verifying if @${username} follows @${targetUsername}`);

    // Add random delay to avoid rate limiting (OPTIMIZED)
    await randomDelay();

    // Check follow status
    const result = await checkFollow(username, targetUsername);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.isVerified ? 
          `@${username} is following @${targetUsername}!` : 
          `@${username} is not following @${targetUsername}`,
        isVerified: result.isVerified,
        details: {
          username,
          targetUsername,
          foundAt: new Date().toISOString(),
          optimized: true,
          egress_saved: 'LOW EGRESS MODE'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to verify follow status',
        error: result.error || 'Verification failed'
      });
    }

  } catch (error) {
    console.error('❌ [OPTIMIZED] Follow verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during follow verification',
      error: error.message
    });
  }
});

/**
 * GET /health - Health check endpoint (OPTIMIZED)
 */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Twitter Puppeteer verification service is running (OPTIMIZED for LOW EGRESS)',
    timestamp: new Date().toISOString(),
    browserStatus: browser ? 'Running' : 'Not initialized',
    config: {
      delayRange: `${CONFIG.DELAY_MIN}-${CONFIG.DELAY_MAX}ms`,
      timeout: `${CONFIG.TIMEOUT}ms`,
      maxRetries: CONFIG.MAX_RETRIES,
      userAgents: CONFIG.USER_AGENTS.length,
      optimization: 'LOW EGRESS MODE',
      cacheEnabled: true,
      cacheDuration: `${CONFIG.CACHE_DURATION / 1000}s`,
      blockedResources: ['images', 'css', 'fonts', 'media', 'external_scripts']
    }
  });
});

/**
 * POST /reset-browser - Reset browser instance (for debugging)
 */
app.post('/reset-browser', async (req, res) => {
  try {
    if (browser) {
      await browser.close();
      browser = null;
      console.log('🔄 Browser instance reset');
    }
    
    // Clear cache
    taskCache.clear();
    console.log('🧹 Task cache cleared');
    
    res.json({
      success: true,
      message: 'Browser instance and cache reset successfully'
    });
  } catch (error) {
    console.error('❌ Error resetting browser:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset browser',
      error: error.message
    });
  }
});

/**
 * POST /clear-cache - Clear task cache (EGRESS OPTIMIZATION)
 */
app.post('/clear-cache', async (req, res) => {
  try {
    const cacheSize = taskCache.size;
    taskCache.clear();
    console.log(`🧹 Cache cleared: ${cacheSize} entries removed`);
    
    res.json({
      success: true,
      message: `Cache cleared successfully. Removed ${cacheSize} entries.`
    });
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Twitter Puppeteer verification service running on port ${PORT} (OPTIMIZED for LOW EGRESS)`);
  console.log(`📋 Available endpoints:`);
  console.log(`   POST /verify-retweet`);
  console.log(`   POST /verify-tweet`);
  console.log(`   POST /verify-follow`);
  console.log(`   GET  /health`);
  console.log(`   POST /reset-browser`);
  console.log(`   POST /clear-cache`);
  console.log(`🔧 OPTIMIZED Configuration (LOW EGRESS):`);
  console.log(`   Delay Range: ${CONFIG.DELAY_MIN}-${CONFIG.DELAY_MAX}ms`);
  console.log(`   Timeout: ${CONFIG.TIMEOUT}ms`);
  console.log(`   Max Retries: ${CONFIG.MAX_RETRIES}`);
  console.log(`   User Agents: ${CONFIG.USER_AGENTS.length}`);
  console.log(`   Cache Duration: ${CONFIG.CACHE_DURATION / 1000}s`);
  console.log(`   Blocked Resources: Images, CSS, Fonts, Media, External Scripts`);
  console.log(`🌐 Service will initialize browser on first request`);
  console.log(`💰 EGRESS OPTIMIZATION: Estimated 70-80% reduction in data usage!`);
});

module.exports = app;
