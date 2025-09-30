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

// Configuration
const CONFIG = {
  DELAY_MIN: 2000,        // Minimum delay between requests (2 seconds)
  DELAY_MAX: 5000,        // Maximum delay between requests (5 seconds)
  TIMEOUT: 30000,         // Page timeout (30 seconds)
  MAX_RETRIES: 3,         // Maximum retries for failed requests
  USER_AGENTS: [          // Rotate user agents to avoid detection
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ]
};

// Browser instance management
let browser = null;
let isInitializing = false;

/**
 * Initialize browser instance
 */
async function initializeBrowser() {
  if (browser || isInitializing) return browser;
  
  isInitializing = true;
  try {
    console.log('🚀 Initializing Puppeteer browser...');
    
    browser = await puppeteer.launch({
      headless: 'new',           // Use new headless mode
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
        '--disable-renderer-backgrounding'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });
    
    console.log('✅ Browser initialized successfully');
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
 * Get random delay to avoid rate limiting
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
 * Wait for random delay
 */
async function randomDelay() {
  const delay = getRandomDelay();
  console.log(`⏳ Waiting ${delay}ms to avoid rate limiting...`);
  await new Promise(resolve => setTimeout(resolve, delay));
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
 * Check if user has retweeted a specific tweet
 */
async function checkRetweet(username, tweetId) {
  let page = null;
  
  try {
    console.log(`🔍 Checking retweet for @${username} on tweet ${tweetId}`);
    
    // Initialize browser if needed
    await initializeBrowser();
    
    // Create new page
    page = await browser.newPage();
    
    // Set random user agent
    await page.setUserAgent(getRandomUserAgent());
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set timeout
    page.setDefaultTimeout(CONFIG.TIMEOUT);
    
    // Navigate to user's profile
    console.log(`🌐 Navigating to @${username}'s profile...`);
    await page.goto(`https://twitter.com/${username}`, { waitUntil: 'networkidle2' });
    
    // Wait for content to load
    await page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });
    
    // Check if tweet ID appears in the timeline
    const hasRetweet = await page.evaluate((id) => {
      // Look for retweet indicators with the tweet ID
      const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
      
      for (const tweet of tweetElements) {
        const tweetText = tweet.textContent || '';
        const tweetLinks = tweet.querySelectorAll('a[href*="/status/"]');
        
        // Check if any link contains the tweet ID
        for (const link of tweetLinks) {
          if (link.href.includes(id)) {
            console.log(`✅ Found retweet with ID ${id}`);
            return true;
          }
        }
        
        // Check if tweet text contains retweet indicators
        if (tweetText.includes('RT') && tweetText.includes(id)) {
          console.log(`✅ Found retweet text with ID ${id}`);
          return true;
        }
      }
      
      return false;
    }, tweetId);
    
    if (hasRetweet) {
      console.log(`✅ Retweet found for @${username} on tweet ${tweetId}`);
      return { success: true, isVerified: true };
    }
    
    // If not found in main timeline, check retweets tab
    console.log(`🔍 Checking retweets tab for @${username}...`);
    
    try {
      // Click on retweets tab
      await page.click('a[href*="/retweets"]');
      await page.waitForTimeout(3000);
      
      // Check retweets tab for the tweet ID
      const hasRetweetInTab = await page.evaluate((id) => {
        const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
        
        for (const tweet of tweetElements) {
          const tweetText = tweet.textContent || '';
          const tweetLinks = tweet.querySelectorAll('a[href*="/status/"]');
          
          for (const link of tweetLinks) {
            if (link.href.includes(id)) {
              return true;
            }
          }
          
          if (tweetText.includes('RT') && tweetText.includes(id)) {
            return true;
          }
        }
        
        return false;
      }, tweetId);
      
      if (hasRetweetInTab) {
        console.log(`✅ Retweet found in retweets tab for @${username} on tweet ${tweetId}`);
        return { success: true, isVerified: true };
      }
    } catch (tabError) {
      console.log(`⚠️ Could not check retweets tab: ${tabError.message}`);
    }
    
    console.log(`❌ No retweet found for @${username} on tweet ${tweetId}`);
    return { success: true, isVerified: false };
    
  } catch (error) {
    console.error(`❌ Error checking retweet for @${username}:`, error);
    return { success: false, isVerified: false, error: error.message };
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * Check if user has posted a tweet with specific keywords
 */
async function checkTweetContent(username, keywords) {
  let page = null;
  
  try {
    console.log(`🔍 Checking tweet content for @${username} with keywords: ${keywords.join(', ')}`);
    
    // Initialize browser if needed
    await initializeBrowser();
    
    // Create new page
    page = await browser.newPage();
    
    // Set random user agent
    await page.setUserAgent(getRandomUserAgent());
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set timeout
    page.setDefaultTimeout(CONFIG.TIMEOUT);
    
    // Navigate to user's profile
    console.log(`🌐 Navigating to @${username}'s profile...`);
    await page.goto(`https://twitter.com/${username}`, { waitUntil: 'networkidle2' });
    
    // Wait for content to load
    await page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });
    
    // Check if keywords appear in recent tweets
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
          console.log(`✅ Found tweet with keywords: ${searchKeywords.join(', ')}`);
          return true;
        }
      }
      
      return false;
    }, keywords);
    
    if (hasKeywords) {
      console.log(`✅ Tweet with keywords found for @${username}: ${keywords.join(', ')}`);
      return { success: true, isVerified: true };
    }
    
    console.log(`❌ No tweet with keywords found for @${username}: ${keywords.join(', ')}`);
    return { success: true, isVerified: false };
    
  } catch (error) {
    console.error(`❌ Error checking tweet content for @${username}:`, error);
    return { success: false, isVerified: false, error: error.message };
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * Check if user follows a specific account
 */
async function checkFollow(username, targetUsername) {
  let page = null;
  
  try {
    console.log(`🔍 Checking if @${username} follows @${targetUsername}`);
    
    // Initialize browser if needed
    await initializeBrowser();
    
    // Create new page
    page = await browser.newPage();
    
    // Set random user agent
    await page.setUserAgent(getRandomUserAgent());
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set timeout
    page.setDefaultTimeout(CONFIG.TIMEOUT);
    
    // Navigate to user's profile
    console.log(`🌐 Navigating to @${username}'s profile...`);
    await page.goto(`https://twitter.com/${username}`, { waitUntil: 'networkidle2' });
    
    // Wait for content to load
    await page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });
    
    // Check if user follows the target account
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
    
    if (isFollowing) {
      console.log(`✅ @${username} is following @${targetUsername}`);
      return { success: true, isVerified: true };
    }
    
    console.log(`❌ @${username} is not following @${targetUsername}`);
    return { success: true, isVerified: false };
    
  } catch (error) {
    console.error(`❌ Error checking follow status for @${username}:`, error);
    return { success: false, isVerified: false, error: error.message };
  } finally {
    if (page) {
      await page.close();
    }
  }
}

// API Endpoints

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

    console.log(`🔍 Verifying retweet for @${username} on tweet: ${tweetUrl}`);
    
    // Extract tweet ID from URL
    const tweetId = extractTweetId(tweetUrl);
    if (!tweetId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tweet URL format',
        error: 'Could not extract tweet ID from URL'
      });
    }

    console.log(`📱 Extracted tweet ID: ${tweetId}`);

    // Add random delay to avoid rate limiting
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
          foundAt: new Date().toISOString()
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
    console.error('❌ Retweet verification error:', error);
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

    console.log(`🔍 Verifying tweet for @${username} with keywords: ${keywords.join(', ')}`);

    // Add random delay to avoid rate limiting
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
          foundAt: new Date().toISOString()
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
    console.error('❌ Tweet verification error:', error);
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

    console.log(`🔍 Verifying if @${username} follows @${targetUsername}`);

    // Add random delay to avoid rate limiting
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
          foundAt: new Date().toISOString()
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
    console.error('❌ Follow verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during follow verification',
      error: error.message
    });
  }
});

/**
 * GET /health - Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Twitter Puppeteer verification service is running',
    timestamp: new Date().toISOString(),
    browserStatus: browser ? 'Running' : 'Not initialized',
    config: {
      delayRange: `${CONFIG.DELAY_MIN}-${CONFIG.DELAY_MAX}ms`,
      timeout: `${CONFIG.TIMEOUT}ms`,
      maxRetries: CONFIG.MAX_RETRIES,
      userAgents: CONFIG.USER_AGENTS.length
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
    
    res.json({
      success: true,
      message: 'Browser instance reset successfully'
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
  console.log(`🚀 Twitter Puppeteer verification service running on port ${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   POST /verify-retweet`);
  console.log(`   POST /verify-tweet`);
  console.log(`   POST /verify-follow`);
  console.log(`   GET  /health`);
  console.log(`   POST /reset-browser`);
  console.log(`🔧 Configuration:`);
  console.log(`   Delay Range: ${CONFIG.DELAY_MIN}-${CONFIG.DELAY_MAX}ms`);
  console.log(`   Timeout: ${CONFIG.TIMEOUT}ms`);
  console.log(`   Max Retries: ${CONFIG.MAX_RETRIES}`);
  console.log(`   User Agents: ${CONFIG.USER_AGENTS.length}`);
  console.log(`🌐 Service will initialize browser on first request`);
});

module.exports = app;
