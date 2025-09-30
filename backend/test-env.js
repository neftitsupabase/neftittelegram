const path = require('path');
const fs = require('fs');

console.log('🔍 Testing Environment Variable Loading...');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
console.log('📁 .env file path:', envPath);
console.log('📁 .env file exists:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  console.log('📄 .env file content:');
  const content = fs.readFileSync(envPath, 'utf8');
  console.log(content);
  
  // Check for Discord variables
  const lines = content.split('\n');
  const discordLines = lines.filter(line => line.includes('DISCORD'));
  console.log('🎯 Discord-related lines:', discordLines);
}

// Try to load with dotenv
try {
  require('dotenv').config({ path: envPath });
  console.log('✅ dotenv loaded successfully');
} catch (error) {
  console.log('❌ dotenv error:', error.message);
}

// Check environment variables
console.log('\n🔍 Environment Variables:');
console.log('   DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? 'SET' : 'NOT SET');
console.log('   DISCORD_GUILD_ID:', process.env.DISCORD_GUILD_ID || 'NOT SET');
console.log('   DISCORD_ROLE_ID_OG:', process.env.DISCORD_ROLE_ID_OG || 'NOT SET');

// Check all environment variables
const allEnvVars = Object.keys(process.env);
const discordVars = allEnvVars.filter(key => key.includes('DISCORD'));
console.log('   All DISCORD env vars:', discordVars);
