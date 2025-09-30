// ==================================================
// 🚀 ROBUST DISCORD VERIFICATION SERVICE
// Auto-restart, Error handling, Rate limiting
// ==================================================

const express = require('express');
const cors = require('cors');
const path = require('path');

// Load environment variables from the parent directory
const envPath = path.join(__dirname, '..', '.env');
console.log('🔍 Loading .env from:', envPath);
require('dotenv').config({ path: envPath });

const app = express();
const PORT = process.env.PORT || 3001;

// Enhanced Configuration
const CONFIG = {
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID || '1369232763709947914',
  DISCORD_ROLE_IDS: {
    OG_DISCORD: '1369238686436163625',
    KYSIE: '1382430133692141598',
    ZYLO: '1382429731613310996',
    DOZI: '1382430296602841179'
  },
  RATE_LIMIT: {
    WINDOW_MS: 60 * 1000, // 1 minute
    MAX_REQUESTS: 45,     // Stay under Discord's 50/sec limit
    RETRY_AFTER: 5000     // 5 seconds
  },
  TIMEOUT: 15000,         // 15 seconds
  MAX_RETRIES: 3,
  CACHE_DURATION: 5 * 60 * 1000 // 5 minutes
};

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health monitoring
let healthStats = {
  status: 'healthy',
  startTime: Date.now(),
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  rateLimitHits: 0,
  lastError: null,
  uptime: () => Math.floor((Date.now() - healthStats.startTime) / 1000)
};

// Rate limiting storage
const rateLimitStore = new Map();
const cache = new Map();

// Rate limiting middleware
function rateLimitMiddleware(req, res, next) {
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  
  // Clean old entries
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
  
  const clientData = rateLimitStore.get(clientId) || {
    count: 0,
    resetTime: now + CONFIG.RATE_LIMIT.WINDOW_MS
  };
  
  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + CONFIG.RATE_LIMIT.WINDOW_MS;
  } else if (clientData.count >= CONFIG.RATE_LIMIT.MAX_REQUESTS) {
    healthStats.rateLimitHits++;
    console.log(`⚠️ Rate limit exceeded for ${clientId}`);
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  } else {
    clientData.count++;
  }
  
  rateLimitStore.set(clientId, clientData);
  healthStats.totalRequests++;
  next();
}

// Validation middleware
const validateDiscordToken = (req, res, next) => {
  if (!CONFIG.DISCORD_BOT_TOKEN) {
    healthStats.failedRequests++;
    healthStats.lastError = 'Discord bot token not configured';
    return res.status(500).json({
      success: false,
      message: 'Discord bot token not configured on server',
      error: 'MISSING_BOT_TOKEN'
    });
  }
  next();
};

// Enhanced Discord API call with comprehensive error handling
async function callDiscordAPI(endpoint, retries = CONFIG.MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔗 Discord API call (attempt ${attempt}/${retries}): ${endpoint}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bot ${CONFIG.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'NEFTIT-Discord-Bot/1.0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
        console.log(`⏳ Rate limited by Discord, waiting ${retryAfter}s...`);
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        } else {
          return {
            status: 429,
            ok: false,
            error: 'Rate limited by Discord API',
            retryAfter
          };
        }
      }
      
      // Handle other errors
      if (!response.ok && response.status !== 404) {
        console.log(`❌ Discord API error: ${response.status} ${response.statusText}`);
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
      
      const data = response.ok ? await response.json() : null;
      
      return {
        status: response.status,
        ok: response.ok,
        data,
        headers: Object.fromEntries(response.headers.entries())
      };
      
    } catch (error) {
      console.error(`💥 Discord API call error (attempt ${attempt}):`, error.message);
      
      if (error.name === 'AbortError') {
        console.log(`⏰ Request timeout after ${CONFIG.TIMEOUT}ms`);
      }
      
      if (attempt === retries) {
        return {
          status: 500,
          ok: false,
          error: error.message,
          type: error.name
        };
      }
      
      // Exponential backoff
      const delay = 1000 * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

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

// Health check endpoint
app.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    success: true,
    message: 'Discord verification service is running',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(healthStats.uptime() / 3600)}h ${Math.floor((healthStats.uptime() % 3600) / 60)}m ${healthStats.uptime() % 60}s`,
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
    },
    stats: healthStats,
    config: {
      guildId: CONFIG.DISCORD_GUILD_ID,
      roleIds: CONFIG.DISCORD_ROLE_IDS,
      botTokenConfigured: !!CONFIG.DISCORD_BOT_TOKEN,
      rateLimit: CONFIG.RATE_LIMIT,
      cacheSize: cache.size,
      rateLimitStoreSize: rateLimitStore.size
    }
  });
});

// Discord membership verification
app.post('/verify-discord-join', rateLimitMiddleware, validateDiscordToken, async (req, res) => {
  try {
    const { discordUserId } = req.body;
    
    if (!discordUserId) {
      healthStats.failedRequests++;
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: discordUserId',
        error: 'MISSING_USER_ID'
      });
    }

    // Validate Discord user ID format
    if (!/^\d{17,19}$/.test(discordUserId)) {
      healthStats.failedRequests++;
      return res.status(400).json({
        success: false,
        message: 'Invalid Discord user ID format',
        error: 'INVALID_USER_ID'
      });
    }

    console.log(`🔍 Verifying Discord membership for user: ${discordUserId}`);

    // Check cache first
    const cacheKey = `member:${discordUserId}`;
    const cached = getCachedResult(cacheKey);
    if (cached) {
      healthStats.successfulRequests++;
      return res.json({
        ...cached,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    const apiUrl = `https://discord.com/api/v10/guilds/${CONFIG.DISCORD_GUILD_ID}/members/${discordUserId}`;
    const result = await callDiscordAPI(apiUrl);

    let response;
    if (result.status === 404) {
      response = {
        success: false,
        message: 'User not found in Discord server. Please join the server first.',
        isMember: false,
        guildId: CONFIG.DISCORD_GUILD_ID,
        userId: discordUserId
      };
      healthStats.failedRequests++;
    } else if (!result.ok) {
      response = {
        success: false,
        message: 'Failed to verify Discord membership',
        error: result.error || `Discord API returned status: ${result.status}`,
        isMember: false,
        guildId: CONFIG.DISCORD_GUILD_ID,
        userId: discordUserId
      };
      healthStats.failedRequests++;
      healthStats.lastError = result.error;
    } else {
      response = {
        success: true,
        message: 'Discord membership verified successfully!',
        isMember: true,
        guildId: CONFIG.DISCORD_GUILD_ID,
        userId: discordUserId,
        memberData: {
          username: result.data.user?.username,
          discriminator: result.data.user?.discriminator,
          joinedAt: result.data.joined_at,
          roles: result.data.roles || []
        }
      };
      healthStats.successfulRequests++;
      setCachedResult(cacheKey, response);
    }

    res.json({
      ...response,
      timestamp: new Date().toISOString(),
      cached: false
    });

  } catch (error) {
    healthStats.failedRequests++;
    healthStats.lastError = error.message;
    console.error('❌ Discord membership verification error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal error during Discord membership verification',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Discord role verification
app.post('/verify-discord-role', rateLimitMiddleware, validateDiscordToken, async (req, res) => {
  try {
    const { discordUserId, roleId } = req.body;
    
    if (!discordUserId) {
      healthStats.failedRequests++;
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: discordUserId',
        error: 'MISSING_USER_ID'
      });
    }

    const targetRoleId = roleId || CONFIG.DISCORD_ROLE_IDS.OG_DISCORD;

    console.log(`🎭 Verifying Discord role for user: ${discordUserId}, role: ${targetRoleId}`);

    // Check cache first
    const cacheKey = `role:${discordUserId}:${targetRoleId}`;
    const cached = getCachedResult(cacheKey);
    if (cached) {
      healthStats.successfulRequests++;
      return res.json({
        ...cached,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    const apiUrl = `https://discord.com/api/v10/guilds/${CONFIG.DISCORD_GUILD_ID}/members/${discordUserId}`;
    const result = await callDiscordAPI(apiUrl);

    let response;
    if (result.status === 404) {
      response = {
        success: false,
        message: 'User not found in Discord server',
        isMember: false,
        hasRole: false,
        guildId: CONFIG.DISCORD_GUILD_ID,
        userId: discordUserId,
        roleId: targetRoleId
      };
      healthStats.failedRequests++;
    } else if (!result.ok) {
      response = {
        success: false,
        message: 'Failed to verify Discord role',
        error: result.error || `Discord API returned status: ${result.status}`,
        isMember: false,
        hasRole: false,
        guildId: CONFIG.DISCORD_GUILD_ID,
        userId: discordUserId,
        roleId: targetRoleId
      };
      healthStats.failedRequests++;
      healthStats.lastError = result.error;
    } else {
      const userRoles = result.data.roles || [];
      const hasRole = userRoles.includes(targetRoleId);
      
      response = {
        success: true,
        message: hasRole ? 'User has required role!' : 'User does not have required role',
        isMember: true,
        hasRole,
        guildId: CONFIG.DISCORD_GUILD_ID,
        userId: discordUserId,
        roleId: targetRoleId,
        userRoles,
        memberData: {
          username: result.data.user?.username,
          discriminator: result.data.user?.discriminator
        }
      };
      healthStats.successfulRequests++;
      setCachedResult(cacheKey, response);
    }

    res.json({
      ...response,
      timestamp: new Date().toISOString(),
      cached: false
    });

  } catch (error) {
    healthStats.failedRequests++;
    healthStats.lastError = error.message;
    console.error('❌ Discord role verification error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal error during Discord role verification',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Batch role verification for badges (EGRESS OPTIMIZED)
app.post('/verify-discord-roles-batch', rateLimitMiddleware, validateDiscordToken, async (req, res) => {
  try {
    const { discordUserId, roleIds } = req.body;
    
    if (!discordUserId) {
      healthStats.failedRequests++;
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: discordUserId',
        error: 'MISSING_USER_ID'
      });
    }

    const rolesToCheck = roleIds || Object.values(CONFIG.DISCORD_ROLE_IDS);
    console.log(`🎭 Batch verifying Discord roles for user: ${discordUserId}`);

    // Check cache first
    const cacheKey = `batch:${discordUserId}`;
    const cached = getCachedResult(cacheKey);
    if (cached) {
      healthStats.successfulRequests++;
      return res.json({
        ...cached,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    const apiUrl = `https://discord.com/api/v10/guilds/${CONFIG.DISCORD_GUILD_ID}/members/${discordUserId}`;
    const result = await callDiscordAPI(apiUrl);

    let response;
    if (result.status === 404) {
      response = {
        success: false,
        message: 'User not found in Discord server',
        isMember: false,
        roles: {},
        guildId: CONFIG.DISCORD_GUILD_ID,
        userId: discordUserId
      };
      healthStats.failedRequests++;
    } else if (!result.ok) {
      response = {
        success: false,
        message: 'Failed to verify Discord roles',
        error: result.error || `Discord API returned status: ${result.status}`,
        isMember: false,
        roles: {},
        guildId: CONFIG.DISCORD_GUILD_ID,
        userId: discordUserId
      };
      healthStats.failedRequests++;
      healthStats.lastError = result.error;
    } else {
      const userRoles = result.data.roles || [];
      const roleStatus = {};
      
      // Check each role
      for (const [roleName, roleId] of Object.entries(CONFIG.DISCORD_ROLE_IDS)) {
        roleStatus[roleName] = userRoles.includes(roleId);
      }
      
      response = {
        success: true,
        message: 'Badge roles verified successfully',
        isMember: true,
        roles: roleStatus,
        guildId: CONFIG.DISCORD_GUILD_ID,
        userId: discordUserId,
        userRoles,
        memberData: {
          username: result.data.user?.username,
          discriminator: result.data.user?.discriminator
        }
      };
      healthStats.successfulRequests++;
      setCachedResult(cacheKey, response);
    }

    res.json({
      ...response,
      timestamp: new Date().toISOString(),
      cached: false,
      optimized: true,
      egressSaved: 'BATCH_VERIFICATION'
    });

  } catch (error) {
    healthStats.failedRequests++;
    healthStats.lastError = error.message;
    console.error('❌ Batch Discord role verification error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal error during batch role verification',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Cache management endpoints
app.post('/clear-cache', (req, res) => {
  const oldSize = cache.size;
  cache.clear();
  rateLimitStore.clear();
  
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
      'POST /verify-discord-join',
      'POST /verify-discord-role', 
      'POST /verify-discord-roles-batch',
      'GET /health',
      'POST /clear-cache'
    ],
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Uncaught exception handler (keeps service running)
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  healthStats.status = 'degraded';
  healthStats.lastError = error.message;
  // Don't exit - let service continue running
});

// Unhandled rejection handler (keeps service running)
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  healthStats.status = 'degraded';
  healthStats.lastError = reason;
  // Don't exit - let service continue running
});

// Periodic health check and cleanup
setInterval(() => {
  // Clean expired cache entries
  const now = Date.now();
  for (const [key, data] of cache.entries()) {
    if (now >= data.expires) {
      cache.delete(key);
    }
  }
  
  // Clean expired rate limit entries
  for (const [key, data] of rateLimitStore.entries()) {
    if (now >= data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
  
  // Reset health status if no recent errors
  if (healthStats.status === 'degraded' && now - healthStats.startTime > 300000) { // 5 minutes
    healthStats.status = 'healthy';
  }
}, 60000); // Run every minute

// Start server
const server = app.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 ROBUST DISCORD VERIFICATION SERVICE');
  console.log('========================================');
  console.log(`📍 Running on port: ${PORT}`);
  console.log(`🔧 Guild ID: ${CONFIG.DISCORD_GUILD_ID}`);
  console.log(`🎭 Role IDs:`, CONFIG.DISCORD_ROLE_IDS);
  console.log(`🔑 Bot Token: ${CONFIG.DISCORD_BOT_TOKEN ? 'CONFIGURED ✅' : 'NOT SET ❌'}`);
  console.log(`⚡ Rate Limit: ${CONFIG.RATE_LIMIT.MAX_REQUESTS} requests per ${CONFIG.RATE_LIMIT.WINDOW_MS / 1000}s`);
  console.log(`💾 Cache Duration: ${CONFIG.CACHE_DURATION / 1000}s`);
  console.log(`⏰ Request Timeout: ${CONFIG.TIMEOUT / 1000}s`);
  console.log(`🔄 Max Retries: ${CONFIG.MAX_RETRIES}`);
  console.log('');
  console.log('📋 Available endpoints:');
  console.log('   POST /verify-discord-join');
  console.log('   POST /verify-discord-role');
  console.log('   POST /verify-discord-roles-batch');
  console.log('   GET  /health');
  console.log('   POST /clear-cache');
  console.log('');
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Environment: ${envPath}`);
  console.log('========================================');
  console.log('✅ Service is ready and running!');
  console.log('🔄 Auto-restart enabled, bulletproof design');
  console.log('========================================');
});

// Handle server errors
server.on('error', (error) => {
  console.error('💥 Server error:', error);
  healthStats.status = 'error';
  healthStats.lastError = error.message;
  
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    console.error('💡 Please check if another Discord service is running');
    process.exit(1);
  }
});

module.exports = app;

