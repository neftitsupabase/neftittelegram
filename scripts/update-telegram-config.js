#!/usr/bin/env node

/**
 * Script to update Telegram bot configuration in .env file
 * Run with: node scripts/update-telegram-config.js
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function updateTelegramConfig() {
  console.log('🤖 Telegram Bot Configuration Update\n');
  
  console.log('Current .env file has placeholder values that need to be replaced.');
  console.log('You need to get these from @BotFather on Telegram.\n');
  
  const botToken = await question('Enter your Telegram bot token (from @BotFather): ');
  const botUsername = await question('Enter your bot username (without @): ');
  
  if (!botToken || !botUsername || botToken.includes('your_') || botUsername.includes('your_')) {
    console.log('❌ Please enter real values, not placeholders. Run the script again.');
    rl.close();
    return;
  }
  
  // Read current .env file
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  try {
    envContent = fs.readFileSync(envPath, 'utf8');
  } catch (error) {
    console.log('❌ Error reading .env file:', error.message);
    rl.close();
    return;
  }
  
  // Replace placeholder values
  envContent = envContent.replace(
    'TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here',
    `TELEGRAM_BOT_TOKEN=${botToken}`
  );
  
  envContent = envContent.replace(
    'VITE_TELEGRAM_BOT_USERNAME=your_bot_username',
    `VITE_TELEGRAM_BOT_USERNAME=${botUsername}`
  );
  
  // Write updated .env file
  try {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file updated successfully!');
  } catch (error) {
    console.log('❌ Error updating .env file:', error.message);
    rl.close();
    return;
  }
  
  console.log('\n📋 Next Steps:');
  console.log('1. Configure your bot domain with @BotFather:');
  console.log('   - Send /setdomain to @BotFather');
  console.log(`   - Select your bot: @${botUsername}`);
  console.log('   - Enter domain: localhost:3000');
  console.log('');
  console.log('2. Test your bot token:');
  console.log(`   - Visit: https://api.telegram.org/bot${botToken}/getMe`);
  console.log('   - You should see bot information, not an error');
  console.log('');
  console.log('3. Restart your development server:');
  console.log('   - Stop the current server (Ctrl+C)');
  console.log('   - Run: npm run dev');
  console.log('');
  console.log('4. Test Telegram authentication in your app');
  
  rl.close();
}

updateTelegramConfig().catch(console.error);
