# Quick Fix: Telegram "Bot Domain Invalid" Error

## The Problem
When clicking on Telegram authentication, you get a "bot domain invalid" error. This happens because the Telegram bot is not properly configured with the correct domain.

## Quick Solution

### Step 1: Set up your Telegram bot
1. Open Telegram and search for `@BotFather`
2. Send `/newbot` to create a new bot
3. Follow the prompts and save your bot token
4. Send `/setdomain` to BotFather
5. Select your bot and enter your domain (e.g., `localhost:3000` for development)

### Step 2: Configure environment variables
Run the setup script:
```bash
npm run setup-telegram
```

Or manually create a `.env` file with:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
VITE_TELEGRAM_BOT_USERNAME=your_bot_username
TELEGRAM_WEBAPP_DOMAIN=localhost:3000
```

### Step 3: Test the configuration
```bash
npm run test-telegram
```

### Step 4: Restart your development server
```bash
npm run dev
```

## For Production
1. Use your actual domain instead of `localhost:3000`
2. Make sure your domain uses HTTPS
3. Configure the domain with @BotFather using `/setdomain`

## Common Issues
- **Domain mismatch**: The domain in BotFather must match your actual domain
- **Missing bot token**: Make sure `TELEGRAM_BOT_TOKEN` is set correctly
- **Wrong bot username**: Ensure `VITE_TELEGRAM_BOT_USERNAME` matches your bot's username

## Need Help?
1. Check the detailed setup guide: `TELEGRAM_BOT_SETUP.md`
2. Run the test script: `npm run test-telegram`
3. Verify your bot configuration with @BotFather
