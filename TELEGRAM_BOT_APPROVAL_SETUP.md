# 🤖 Telegram Bot Approval Flow Setup Guide

## 🎯 Overview

This guide will help you set up the Telegram bot integration for the approval flow, similar to Galxe's implementation.

## 📋 Prerequisites

1. **Telegram Bot Token** from BotFather
2. **Bot Username** (without @)
3. **Webhook URL** for your deployed app

## 🔧 Step 1: Create Telegram Bot

1. **Open Telegram** and search for `@BotFather`
2. **Start a chat** with BotFather
3. **Send `/newbot`** command
4. **Enter bot name**: `NEFTIT Auth Bot`
5. **Enter bot username**: `neftit_auth_bot` (must end with 'bot')
6. **Copy the bot token** (format: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

## 🔧 Step 2: Configure Bot Settings

1. **Set bot description**:
   ```
   /setdescription
   @neftit_auth_bot
   NEFTIT authentication bot for secure login confirmations
   ```

2. **Set bot commands**:
   ```
   /setcommands
   @neftit_auth_bot
   start - Start the bot
   help - Get help information
   ```

3. **Enable inline mode** (optional):
   ```
   /setinline
   @neftit_auth_bot
   ```

## 🔧 Step 3: Configure Environment Variables

Add these to your `.env` file:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
VITE_TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
VITE_TELEGRAM_BOT_USERNAME=neftit_auth_bot

# App URL for webhooks
VITE_APP_URL=https://your-app-domain.vercel.app
```

## 🔧 Step 4: Set Up Webhook

1. **Deploy your app** to Vercel
2. **Set the webhook** by calling:
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
        -H "Content-Type: application/json" \
        -d '{"url": "https://your-app-domain.vercel.app/api/telegram/webhook"}'
   ```

3. **Verify webhook** is set:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
   ```

## 🔧 Step 5: Test the Flow

1. **Start your app** locally or visit the deployed version
2. **Click Telegram login** button
3. **Enter your phone number** when prompted
4. **Check your Telegram** for the approval message
5. **Click "Confirm Login"** button
6. **Verify** that you're logged in successfully

## 🚀 How It Works

### **Login Flow:**
1. User clicks "Log in with Telegram"
2. Telegram widget opens asking for phone number
3. User enters phone number
4. **Bot sends approval message** with Confirm/Decline buttons
5. User clicks "Confirm Login" in Telegram
6. Bot calls backend API to verify and create session
7. User is logged in successfully

### **Security Features:**
- ✅ **Hash verification** using Telegram's signature system
- ✅ **Time-based expiration** (5 minutes for approval)
- ✅ **User ID verification** to prevent spoofing
- ✅ **Secure token handling** via environment variables

## 🔍 Troubleshooting

### **Bot Not Sending Messages:**
- Check if bot token is correct
- Verify bot is not blocked by user
- Check webhook is properly set

### **Approval Message Not Received:**
- Ensure user has started a chat with the bot
- Check if bot has permission to send messages
- Verify webhook URL is accessible

### **Login Fails After Confirmation:**
- Check backend API logs
- Verify hash signature validation
- Ensure environment variables are set correctly

## 📱 User Experience

### **What Users See:**
1. **Login Button** → Click "Log in with Telegram"
2. **Phone Input** → Enter phone number
3. **Loading Screen** → "Sending Approval Request..."
4. **Telegram Message** → "NEFTIT Login Request" with buttons
5. **Confirmation** → Click "✅ Confirm Login"
6. **Success** → Logged in to the app

### **Security Messages:**
- **Approval Message**: Shows user details and timestamp
- **Confirm Button**: "✅ Confirm Login"
- **Decline Button**: "❌ Decline"
- **Success Message**: "Login confirmed! You can now close this message."
- **Decline Message**: "Login declined. If this was not you, your account is secure."

## 🎉 Success!

Once configured, your Telegram authentication will work exactly like Galxe's flow:

1. ✅ **Phone number input** (existing)
2. ✅ **Bot approval message** (new)
3. ✅ **Confirm/Decline buttons** (new)
4. ✅ **Backend verification** (new)
5. ✅ **Session creation** (existing)

The user experience is now secure and user-friendly! 🚀
