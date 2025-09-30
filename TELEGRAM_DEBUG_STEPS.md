# 🔍 Telegram Debug - Step by Step Fix

## ❌ Current Issue
Your .env file has placeholder values instead of real bot credentials:
- `TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here` ❌
- `VITE_TELEGRAM_BOT_USERNAME=your_bot_username` ❌

## ✅ IMMEDIATE FIX NEEDED

### Step 1: Get Your Bot Credentials
1. Open Telegram app
2. Search for `@BotFather`
3. Send `/mybots`
4. Select your bot
5. **Copy the bot token** (long string of numbers and letters)
6. **Copy the bot username** (without @)

### Step 2: Update .env File
Edit your `.env` file and replace these lines:

**BEFORE (current):**
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
VITE_TELEGRAM_BOT_USERNAME=your_bot_username
```

**AFTER (replace with your actual values):**
```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
VITE_TELEGRAM_BOT_USERNAME=your_actual_bot_name
```

### Step 3: Configure Bot Domain
1. In BotFather chat, send `/setdomain`
2. Select your bot
3. Enter: `localhost:3000`
4. Confirm

### Step 4: Restart Server
```bash
npm run dev
```

## 🧪 Test Your Bot Token
Visit this URL (replace YOUR_TOKEN with your actual token):
```
https://api.telegram.org/botYOUR_TOKEN/getMe
```

You should see bot information, not an error.

## 🚨 Common Mistakes
- ❌ Using placeholder values in .env
- ❌ Forgetting to set domain in BotFather
- ❌ Not restarting the dev server
- ❌ Typos in bot username or token

## ✅ Success Checklist
- [ ] Bot token is real (not placeholder)
- [ ] Bot username is real (not placeholder)
- [ ] Domain set to `localhost:3000` in BotFather
- [ ] Dev server restarted
- [ ] Bot token test URL works
