# 🔧 Telegram "Bot Domain Invalid" - IMMEDIATE FIX

## The Problem
When you click Telegram authentication, you get "bot domain invalid" error because the bot isn't configured with the correct domain.

## ⚡ QUICK FIX (5 minutes)

### Step 1: Create Telegram Bot
1. Open Telegram app
2. Search for `@BotFather`
3. Send `/newbot`
4. Follow prompts to create bot
5. **SAVE THE BOT TOKEN** (you'll need it)

### Step 2: Configure Bot Domain
1. In BotFather chat, send `/setdomain`
2. Select your bot from the list
3. Enter domain: `localhost:3000` (for development)
4. Confirm the setting

### Step 3: Create Environment File
Create a file named `.env` in your project root with this content:

```env
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_FROM_STEP_1
VITE_TELEGRAM_BOT_USERNAME=YOUR_BOT_USERNAME
TELEGRAM_WEBAPP_DOMAIN=localhost:3000
VITE_AUTH_DOMAIN=localhost:3000
```

**Replace:**
- `YOUR_BOT_TOKEN_FROM_STEP_1` with the token from BotFather
- `YOUR_BOT_USERNAME` with your bot's username (without @)

### Step 4: Restart Development Server
```bash
npm run dev
```

## ✅ That's It!
Your Telegram authentication should now work without the "bot domain invalid" error.

## 🚨 If Still Not Working

### Check These:
1. **Bot token is correct** - Copy exactly from BotFather
2. **Domain matches** - Must be exactly `localhost:3000` in both BotFather and .env
3. **Server restarted** - After creating .env file
4. **No typos** - In bot username or token

### Test Your Bot:
1. Go to `https://api.telegram.org/botYOUR_BOT_TOKEN/getMe`
2. Replace `YOUR_BOT_TOKEN` with your actual token
3. You should see bot information, not an error

## 📱 For Production Later
When deploying to production:
1. Use your actual domain instead of `localhost:3000`
2. Make sure domain uses HTTPS
3. Update domain in BotFather with `/setdomain`

## 🆘 Need Help?
- Double-check bot token from BotFather
- Ensure domain is exactly `localhost:3000`
- Restart your dev server after changes
- Check browser console for any error messages
