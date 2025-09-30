# Discord Task Verification Setup

## Environment Variables Required

Add these environment variables to your Supabase Edge Functions environment:

```bash
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_GUILD_ID=1369232763709947914
DISCORD_ROLE_ID=1369238686436163625
```

## Discord Bot Setup

1. **Create a Discord Bot:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to the "Bot" section
   - Create a bot and copy the token

2. **Bot Permissions Required:**
   - `guilds.members.read` - To check if users are members
   - `guilds.read` - To read server information
   - `roles.read` - To read role information

3. **Invite Bot to Server:**
   - Use this invite link with the required permissions:
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=1024&scope=bot
   ```

## Task Types Supported

### 1. Discord Join Task (`discord_join`)
- Verifies if user has joined the Discord server
- Uses the guild ID: `1369232763709947914`

### 2. Discord Role Task (`discord_role`)
- Verifies if user has the required role
- Uses the role ID: `1369238686436163625`
- Automatically checks membership first

## How It Works

1. **User connects Discord account** in Edit Profile
2. **User clicks task button** (Join Discord or Verify Role)
3. **System verifies Discord connection** exists
4. **System calls Discord API** to verify membership/role
5. **Task is marked complete** if verification succeeds

## Testing

1. Connect a Discord account in Edit Profile
2. Try to complete Discord tasks
3. Check browser console for verification logs
4. Verify tasks are marked as complete

## Troubleshooting

- **Bot token not configured**: Check `DISCORD_BOT_TOKEN` environment variable
- **User not found**: Ensure user has joined the Discord server
- **Role not found**: Ensure user has the required role assigned
- **Permission denied**: Check bot permissions in Discord server
