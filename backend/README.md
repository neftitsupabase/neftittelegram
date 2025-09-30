# Discord Verification Backend Service

A Node.js/Express backend service for verifying Discord tasks including server membership and role verification.

## Features

- ✅ Verify Discord server membership
- ✅ Verify specific Discord roles (e.g., OG role)
- ✅ Complete verification (membership + role)
- ✅ Secure bot token handling
- ✅ Comprehensive error handling
- ✅ Health check endpoint
- ✅ CORS enabled

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Variables

Create a `.env` file in the backend directory:

```env
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_GUILD_ID=1369232763709947914
DISCORD_ROLE_ID_OG=1369238686436163625

# Server Configuration
PORT=3001
NODE_ENV=development
```

### 3. Start the Service

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## API Endpoints

### POST /verify-discord-join
Check if a user is a member of the Discord server.

**Request:**
```json
{
  "discordUserId": "123456789012345678"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Discord membership verified successfully!",
  "isMember": true,
  "memberData": {
    "username": "username",
    "discriminator": "1234",
    "joinedAt": "2023-01-01T00:00:00.000Z",
    "roles": ["role1", "role2"]
  }
}
```

### POST /verify-discord-role
Check if a user has the required role in the Discord server.

**Request:**
```json
{
  "discordUserId": "123456789012345678"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OG role verified successfully!",
  "hasRole": true,
  "roleId": "1369238686436163625"
}
```

### POST /verify-discord-complete
Check both membership and role in a single request.

**Request:**
```json
{
  "discordUserId": "123456789012345678"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Discord membership and OG role verified successfully!",
  "isMember": true,
  "hasRole": true,
  "roleId": "1369238686436163625",
  "userRoles": ["role1", "role2"]
}
```

### GET /health
Health check endpoint to verify service status.

**Response:**
```json
{
  "success": true,
  "message": "Discord verification service is running",
  "timestamp": "2023-01-01T00:00:00.000Z",
  "config": {
    "guildId": "1369232763709947914",
    "roleId": "1369238686436163625",
    "botTokenConfigured": true
  }
}
```

## Discord Bot Requirements

Your Discord bot needs the following permissions:
- **Server Members Intent** enabled
- **Read Messages** permission
- Access to the guild/server you want to verify

## Error Handling

The service returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

Common error scenarios:
- `400`: Missing required parameters
- `404`: User not found in Discord server
- `500`: Server errors or Discord API failures

## Security Features

- Bot token is never exposed to the frontend
- CORS enabled for cross-origin requests
- Input validation for all endpoints
- Comprehensive error logging

## Testing

Test the endpoints using curl or Postman:

```bash
# Test health endpoint
curl http://localhost:3001/health

# Test Discord membership verification
curl -X POST http://localhost:3001/verify-discord-join \
  -H "Content-Type: application/json" \
  -d '{"discordUserId": "123456789012345678"}'

# Test Discord role verification
curl -X POST http://localhost:3001/verify-discord-role \
  -H "Content-Type: application/json" \
  -d '{"discordUserId": "123456789012345678"}'
```

## Integration with Frontend

Update your frontend Discord verification service to use these endpoints instead of Supabase Edge Functions:

```javascript
// Example frontend integration
const verifyDiscordMembership = async (discordUserId) => {
  const response = await fetch('http://localhost:3001/verify-discord-join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ discordUserId })
  });
  
  return await response.json();
};
```
