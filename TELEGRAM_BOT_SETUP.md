# Telegram Bot Setup Guide

## Issue: "Bot Domain Invalid" Error

The "bot domain invalid" error occurs when the Telegram bot is not properly configured with the correct domain in the Telegram Bot API settings.

## Solution Steps

### 1. Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Start a chat with BotFather
3. Send `/newbot` command
4. Follow the prompts to create your bot
5. Save the bot token provided by BotFather

### 2. Configure Bot Domain

1. In the chat with BotFather, send `/setdomain`
2. Select your bot from the list
3. Enter your domain (e.g., `yourdomain.com` or `localhost:3000` for development)
4. Confirm the domain setting

### 3. Set Up WebApp

1. Send `/newapp` to BotFather
2. Select your bot
3. Enter app title (e.g., "Neftit Authentication")
4. Enter app description
5. Upload an app icon (optional)
6. Enter your WebApp URL (e.g., `https://yourdomain.com/auth/telegram`)

### 4. Environment Variables

Create a `.env` file in your project root with:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_BOT_USERNAME=your_bot_username
TELEGRAM_WEBAPP_DOMAIN=your_domain.com
```

### 5. Update Code Configuration

The current code uses a hardcoded bot name `neftit_bot`. Update the configuration to use environment variables:

```typescript
const TELEGRAM_BOT = process.env.TELEGRAM_BOT_USERNAME || "neftit_bot";
```

### 6. Development vs Production

For development:
- Use `localhost:3000` as the domain
- Use `http://localhost:3000` as the WebApp URL

For production:
- Use your actual domain
- Use `https://yourdomain.com` as the WebApp URL

## Common Issues

1. **Domain Mismatch**: Ensure the domain in BotFather matches your actual domain
2. **HTTPS Required**: Production domains must use HTTPS
3. **Bot Token**: Make sure the bot token is correct and not expired
4. **WebApp URL**: The WebApp URL must be accessible and return valid HTML

## Testing

1. Open your application
2. Click on Telegram login
3. The Telegram WebApp should open without domain errors
4. Complete the authentication flow

## Security Notes

- Never commit your bot token to version control
- Use environment variables for all sensitive configuration
- Regularly rotate your bot token if compromised
