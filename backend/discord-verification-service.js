const express = require('express');
const cors = require('cors');
const path = require('path');

// Load environment variables from the parent directory (main project .env)
const envPath = path.join(__dirname, '..', '.env');
console.log('🔍 Looking for .env file at:', envPath);
require('dotenv').config({ path: envPath });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_ROLE_ID_OG = process.env.DISCORD_ROLE_ID_OG;

// Updated: Add all the role IDs needed for your badge system
const DISCORD_ROLE_IDS = {
  OG_DISCORD: '1369238686436163625',      // OG Discord Badge
  KYSIE: '1382430133692141598',           // Kysie Badge  
  ZYLO: '1382429731613310996',            // Zylo Badge
  DOZI: '1382430296602841179'             // Dozi Badge
};

// Debug environment variables
console.log('🔍 Environment Variables Debug:');
console.log('   process.env.DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? 'SET' : 'NOT SET');
console.log('   process.env.DISCORD_GUILD_ID:', process.env.DISCORD_GUILD_ID || 'NOT SET');
console.log('   process.env.DISCORD_ROLE_ID_OG:', process.env.DISCORD_ROLE_ID_OG || 'NOT SET');
console.log('   All env vars:', Object.keys(process.env).filter(key => key.includes('DISCORD')));
console.log('   Configured Role IDs:', DISCORD_ROLE_IDS);

// Validation middleware
const validateDiscordToken = (req, res, next) => {
  if (!DISCORD_BOT_TOKEN) {
    return res.status(500).json({
      success: false,
      message: 'Discord bot token not configured on server'
    });
  }
  next();
};

// Helper function to make Discord API calls
async function callDiscordAPI(endpoint) {
  try {
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    
    return {
      status: response.status,
      ok: response.ok,
      data: response.ok ? await response.json() : null
    };
  } catch (error) {
    console.error('Discord API call error:', error);
    return {
      status: 500,
      ok: false,
      error: error.message
    };
  }
}

// POST /verify-discord-join - Check if user is a member of the guild
app.post('/verify-discord-join', validateDiscordToken, async (req, res) => {
  try {
    const { discordUserId, guildId } = req.body;
    
    if (!discordUserId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: discordUserId'
      });
    }

    // Use provided guildId or fallback to default
    const targetGuildId = guildId || DISCORD_GUILD_ID;
    
    console.log(`Verifying Discord membership for user: ${discordUserId} in guild: ${targetGuildId}`);
    console.log(`Guild ID source: ${guildId ? 'request body' : 'environment variable'}`);

    // Call Discord API to check guild membership
    const discordApiUrl = `https://discord.com/api/v10/guilds/${targetGuildId}/members/${discordUserId}`;
    const result = await callDiscordAPI(discordApiUrl);

    if (result.status === 404) {
      return res.json({
        success: false,
        message: 'User not found in Discord server. Please join the Discord server first.',
        isMember: false
      });
    }

    if (!result.ok) {
      console.error('Discord API error:', result.status);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify Discord membership',
        error: `Discord API returned status: ${result.status}`
      });
    }

    // User is a member of the server
    const memberData = result.data;
    console.log(`User ${discordUserId} is a member of guild ${targetGuildId}`);

    return res.json({
      success: true,
      message: 'Discord membership verified successfully!',
      isMember: true,
      guildId: targetGuildId,
      userId: discordUserId,
      memberData: {
        username: memberData.user?.username,
        discriminator: memberData.user?.discriminator,
        joinedAt: memberData.joined_at,
        roles: memberData.roles || []
      }
    });

  } catch (error) {
    console.error('Error verifying Discord membership:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during membership verification',
      error: error.message
    });
  }
});

// POST /verify-discord-role - Check if user has the required role
app.post('/verify-discord-role', validateDiscordToken, async (req, res) => {
  try {
    const { discordUserId, guildId, roleId } = req.body;
    
    if (!discordUserId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: discordUserId'
      });
    }

    // Use provided guildId and roleId or fallback to defaults
    const targetGuildId = guildId || DISCORD_GUILD_ID;
    const targetRoleId = roleId || DISCORD_ROLE_ID_OG;
    
    console.log(`Verifying Discord role for user: ${discordUserId} in guild: ${targetGuildId} for role: ${targetRoleId}`);
    console.log(`Guild ID source: ${guildId ? 'request body' : 'environment variable'}`);
    console.log(`Role ID source: ${roleId ? 'request body' : 'environment variable'}`);

    // Call Discord API to check guild membership and roles
    const discordApiUrl = `https://discord.com/api/v10/guilds/${targetGuildId}/members/${discordUserId}`;
    const result = await callDiscordAPI(discordApiUrl);

    if (result.status === 404) {
      return res.json({
        success: false,
        message: 'User not found in Discord server. Please join the Discord server first.',
        hasRole: false
      });
    }

    if (!result.ok) {
      console.error('Discord API error:', result.status);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify Discord role',
        error: `Discord API returned status: ${result.status}`
      });
    }

    // User is a member, now check if they have the required role
    const memberData = result.data;
    const userRoles = memberData.roles || [];
    const hasRole = userRoles.includes(targetRoleId);

    console.log(`User ${discordUserId} roles:`, userRoles);
    console.log(`Required role ${targetRoleId} found:`, hasRole);

    if (hasRole) {
      return res.json({
        success: true,
        message: 'Discord role verified successfully!',
        hasRole: true,
        guildId: targetGuildId,
        roleId: targetRoleId,
        userId: discordUserId
      });
    } else {
      return res.json({
        success: true,
        message: 'User does not have required role',
        isMember: true,
        hasRole: false,
        guildId: targetGuildId,
        roleId: targetRoleId,
        userId: discordUserId
      });
    }

  } catch (error) {
    console.error('Error verifying Discord role:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during role verification',
      error: error.message
    });
  }
});

// POST /verify-discord-complete - Check both membership and role
app.post('/verify-discord-complete', validateDiscordToken, async (req, res) => {
  try {
    const { discordUserId } = req.body;
    
    if (!discordUserId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: discordUserId'
      });
    }

    console.log(`Verifying Discord complete for user: ${discordUserId}`);

    // First check membership
    const membershipResult = await callDiscordAPI(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordUserId}`
    );

    if (membershipResult.status === 404) {
      return res.json({
        success: false,
        message: 'Please join the Discord server first before verifying role',
        isMember: false,
        hasRole: false
      });
    }

    if (!membershipResult.ok) {
      return res.status(500).json({
        success: false,
        message: 'Failed to verify Discord membership',
        error: `Discord API returned status: ${membershipResult.status}`
      });
    }

    // User is a member, now check role
    const memberData = membershipResult.data;
    const userRoles = memberData.roles || [];
    const hasRole = userRoles.includes(DISCORD_ROLE_ID_OG);

    console.log(`User ${discordUserId} is member: true, has role: ${hasRole}`);

    return res.json({
      success: true,
      message: hasRole ? 'Discord membership and OG role verified successfully!' : 'Discord membership verified, but OG role not found',
      isMember: true,
      hasRole: hasRole,
      roleId: DISCORD_ROLE_ID_OG,
      userRoles: userRoles
    });

  } catch (error) {
    console.error('Error verifying Discord complete:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during Discord verification',
      error: error.message
    });
  }
});

// NEW: Verify all Discord roles for badge system (EGRESS OPTIMIZATION)
app.post('/verify-discord-roles-batch', validateDiscordToken, async (req, res) => {
  try {
    const { discordUserId, roleIds, guildId } = req.body;
    
    if (!discordUserId || !roleIds || !guildId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Discord user ID, role IDs, and guild ID are required',
        error: 'Missing required parameters'
      });
    }

    console.log(`🚀 Batch verifying Discord roles for user: ${discordUserId} in guild: ${guildId}`);
    console.log(`🎯 Checking roles: ${roleIds.join(', ')}`);

    // Get user's member info with roles
    const discordApiUrl = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`;
    const result = await callDiscordAPI(discordApiUrl);
    
    if (result.status === 404) {
      return res.json({
        success: true,
        message: 'User is not a member of the Discord server',
        roleStatus: {}
      });
    }

    if (!result.ok) {
      console.error('Discord API error:', result.status);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify Discord roles',
        error: `Discord API returned status: ${result.status}`
      });
    }

    const userRoles = result.data.roles || [];
    console.log(`User ${discordUserId} roles: [${userRoles.join(', ')}]`);

    // Check each required role
    const roleStatus = {};
    roleIds.forEach(roleId => {
      const hasRole = userRoles.includes(roleId);
      roleStatus[roleId] = hasRole;
      console.log(`Required role ${roleId} found: ${hasRole}`);
    });

    res.json({
      success: true,
      message: 'Discord roles verified successfully',
      roleStatus: roleStatus
    });
  } catch (error) {
    console.error('❌ Batch Discord role verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify Discord roles',
      error: error.message
    });
  }
});

// NEW: Verify all badge roles for a user (EGRESS OPTIMIZATION)
app.post('/verify-badge-roles', validateDiscordToken, async (req, res) => {
  try {
    const { discordUserId } = req.body;
    
    if (!discordUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Discord user ID is required',
        error: 'Missing required parameter'
      });
    }

    console.log(`🎯 Verifying badge roles for user: ${discordUserId} in guild: ${DISCORD_GUILD_ID}`);

    // Get user's member info with roles
    const discordApiUrl = `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordUserId}`;
    const result = await callDiscordAPI(discordApiUrl);
    
    if (result.status === 404) {
      return res.json({
        success: true,
        message: 'User is not a member of the Discord server',
        roles: {},
        isMember: false
      });
    }

    if (!result.ok) {
      console.error('Discord API error:', result.status);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify Discord roles',
        error: `Discord API returned status: ${result.status}`
      });
    }

    const userRoles = result.data.roles || [];
    console.log(`User ${discordUserId} roles: [${userRoles.join(', ')}]`);

    // Check each badge role
    const badgeRoles = {
      OG_DISCORD: userRoles.includes(DISCORD_ROLE_IDS.OG_DISCORD),
      KYSIE: userRoles.includes(DISCORD_ROLE_IDS.KYSIE),
      ZYLO: userRoles.includes(DISCORD_ROLE_IDS.ZYLO),
      DOZI: userRoles.includes(DISCORD_ROLE_IDS.DOZI)
    };

    console.log(`Badge role status:`, badgeRoles);

    res.json({
      success: true,
      message: 'Badge roles verified successfully',
      roles: badgeRoles,
      isMember: true,
      guildId: DISCORD_GUILD_ID,
      userId: discordUserId
    });
  } catch (error) {
    console.error('❌ Badge role verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify badge roles',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Discord verification service is running',
    timestamp: new Date().toISOString(),
    config: {
      guildId: DISCORD_GUILD_ID,
      roleIds: DISCORD_ROLE_IDS,
      botTokenConfigured: !!DISCORD_BOT_TOKEN
    }
  });
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Discord verification service running on port ${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   POST /verify-discord-join`);
  console.log(`   POST /verify-discord-role`);
  console.log(`   POST /verify-discord-complete`);
  console.log(`   POST /verify-discord-roles-batch (NEW - EGRESS OPTIMIZED)`);
  console.log(`   POST /verify-badge-roles (NEW - BADGE SYSTEM)`);
  console.log(`   GET  /health`);
  console.log(`🔧 Configuration:`);
  console.log(`   Guild ID: ${DISCORD_GUILD_ID || 'NOT SET'}`);
  console.log(`   Role IDs:`, DISCORD_ROLE_IDS);
  console.log(`   Bot Token: ${DISCORD_BOT_TOKEN ? 'CONFIGURED' : 'NOT SET'}`);
  console.log(`   Bot Token Length: ${DISCORD_BOT_TOKEN ? DISCORD_BOT_TOKEN.length : 0}`);
  console.log(`   Bot Token Preview: ${DISCORD_BOT_TOKEN ? DISCORD_BOT_TOKEN.substring(0, 10) + '...' : 'N/A'}`);
  console.log(`   Environment File Path: ${path.join(__dirname, '..', '.env')}`);
});

module.exports = app;