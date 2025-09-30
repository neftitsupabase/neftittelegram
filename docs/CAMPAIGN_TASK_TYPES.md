# Campaign Task Types Documentation

This document describes all available campaign task types in the NEFTIT platform and how to configure them.

## Overview

The NEFTIT platform now supports 10 different campaign task types to engage users across various social platforms and activities:

### New Task Types Added:
1. **Twitter Follow** (`twitter_follow`)
2. **Twitter Retweet** (`twitter_retweet`) 
3. **Twitter Post** (`twitter_post`)
4. **Discord Join** (`discord_join`)
5. **Discord Role Detection** (`discord_role`)
6. **Telegram Join** (`telegram_join`)
7. **Visit Website** (`visit_website`)
8. **Quiz** (`quiz`)

### Task Types Available:
Only the 8 specific task types listed above are supported. Legacy task types have been removed for a cleaner, more focused campaign system.

## Task Type Configurations

### 1. Twitter Follow (`twitter_follow`)

**Purpose**: Users must follow a specific Twitter account.

**Required Fields**:
- `twitter_username`: The Twitter handle to follow (without @)
- `action_url`: Twitter profile URL

**Example**:
```json
{
  "type": "twitter_follow",
  "title": "Follow @NEFTIT on Twitter",
  "description": "Follow our official Twitter account for updates",
  "twitter_username": "NEFTIT",
  "action_url": "https://twitter.com/NEFTIT"
}
```

**UI Display**: Shows Twitter icon with "Follow on Twitter" button

---

### 2. Twitter Retweet (`twitter_retweet`)

**Purpose**: Users must retweet a specific tweet.

**Required Fields**:
- `twitter_tweet_id`: The ID of the tweet to retweet
- `action_url`: Direct link to the tweet

**Example**:
```json
{
  "type": "twitter_retweet",
  "title": "Retweet Our Launch Post",
  "description": "Help spread the word about our campaign",
  "twitter_tweet_id": "1234567890123456789",
  "action_url": "https://twitter.com/NEFTIT/status/1234567890123456789"
}
```

**UI Display**: Shows repeat icon with "Retweet Post" button

---

### 3. Twitter Post (`twitter_post`)

**Purpose**: Users must create their own tweet (usually with specific hashtags or mentions).

**Required Fields**:
- `action_url`: Twitter compose URL with pre-filled content

**Example**:
```json
{
  "type": "twitter_post",
  "title": "Tweet About NEFTIT",
  "description": "Create a tweet mentioning @NEFTIT with #NFTCampaign",
  "action_url": "https://twitter.com/intent/tweet?text=Excited%20to%20join%20%40NEFTIT%20%23NFTCampaign"
}
```

**UI Display**: Shows edit icon with "Create Tweet" button

---

### 4. Discord Join (`discord_join`)

**Purpose**: Users must join a Discord server.

**Required Fields**:
- `action_url`: Discord invite link

**Optional Fields**:
- `discord_guild_id`: Discord server ID for verification

**Example**:
```json
{
  "type": "discord_join",
  "title": "Join NEFTIT Discord",
  "description": "Join our community Discord server",
  "action_url": "https://discord.gg/neftit",
  "discord_guild_id": "123456789012345678"
}
```

**UI Display**: Shows message circle icon with "Join Discord" button

---

### 5. Discord Role Detection (`discord_role`)

**Purpose**: Users must have a specific role in a Discord server.

**Required Fields**:
- `discord_guild_id`: Discord server ID
- `required_role_id`: Specific role ID that user must have

**Example**:
```json
{
  "type": "discord_role",
  "title": "Get Verified Role",
  "description": "Obtain the 'Verified' role in our Discord server",
  "discord_guild_id": "123456789012345678",
  "required_role_id": "987654321098765432"
}
```

**UI Display**: Shows user-plus icon with "Get Discord Role" button

---

### 6. Telegram Join (`telegram_join`)

**Purpose**: Users must join a Telegram channel or group.

**Required Fields**:
- `telegram_channel_id`: Telegram channel username or ID
- `action_url`: Telegram join link

**Example**:
```json
{
  "type": "telegram_join",
  "title": "Join NEFTIT Telegram",
  "description": "Join our Telegram channel for updates",
  "telegram_channel_id": "@neftit_official",
  "action_url": "https://t.me/neftit_official"
}
```

**UI Display**: Shows send icon with "Join Telegram" button

---

### 7. Visit Website (`visit_website`)

**Purpose**: Users must visit a specific website.

**Required Fields**:
- `website_url`: URL of the website to visit
- `action_url`: Same as website_url (for consistency)

**Example**:
```json
{
  "type": "visit_website",
  "title": "Visit NEFTIT Website",
  "description": "Explore our official website and learn about features",
  "website_url": "https://neftit.com",
  "action_url": "https://neftit.com"
}
```

**UI Display**: Shows globe icon with "Visit Website" button

---

### 8. Quiz (`quiz`)

**Purpose**: Users must complete a knowledge quiz with a minimum passing score.

**Required Fields**:
- `quiz_questions`: JSON array of questions with options and correct answers
- `quiz_passing_score`: Minimum percentage score to pass (default: 70)

**Example**:
```json
{
  "type": "quiz",
  "title": "NEFTIT Knowledge Quiz",
  "description": "Test your knowledge about NEFTIT and blockchain",
  "quiz_passing_score": 80,
  "quiz_questions": [
    {
      "question": "What does NEFTIT stand for?",
      "options": ["NFT Trading Platform", "Blockchain Gaming", "Digital Collectibles", "Crypto Exchange"],
      "correct_answer": 0,
      "points": 10
    },
    {
      "question": "What blockchain does NEFTIT use?",
      "options": ["Bitcoin", "Ethereum", "Polygon", "Solana"],
      "correct_answer": 2,
      "points": 10
    }
  ]
}
```

**UI Display**: Shows help-circle icon with "Take Quiz" button

---

## Database Schema

### Project Tasks Table Structure

```sql
CREATE TABLE project_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    title TEXT NOT NULL,
    description TEXT,
    type task_type NOT NULL,
    action_url TEXT,
    
    -- Discord fields
    discord_user_id TEXT,
    discord_guild_id TEXT,
    required_role_id TEXT,
    
    -- New fields for enhanced task types
    telegram_channel_id TEXT,
    website_url TEXT,
    quiz_questions JSONB,
    quiz_passing_score INTEGER DEFAULT 70,
    twitter_username TEXT,
    twitter_tweet_id TEXT,
    
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Task Type Enum

```sql
CREATE TYPE task_type AS ENUM (
    'twitter_follow',
    'twitter_retweet', 
    'twitter_post',
    'discord_join',
    'discord_role',
    'telegram_join',
    'visit_website',
    'quiz'
);
```

## Frontend Integration

### Icons Used

Each task type has a specific icon in the UI:

- **Twitter Follow**: `Twitter` icon
- **Twitter Retweet**: `Repeat` icon  
- **Twitter Post**: `Edit` icon
- **Discord Join**: `MessageCircle` icon
- **Discord Role**: `UserPlus` icon
- **Telegram Join**: `Send` icon
- **Visit Website**: `Globe` icon
- **Quiz**: `HelpCircle` icon

### Button Text

Each task type displays specific button text:

- **Twitter Follow**: "Follow on Twitter"
- **Twitter Retweet**: "Retweet Post"
- **Twitter Post**: "Create Tweet"
- **Discord Join**: "Join Discord"
- **Discord Role**: "Get Discord Role"
- **Telegram Join**: "Join Telegram"
- **Visit Website**: "Visit Website"
- **Quiz**: "Take Quiz"

## Implementation Files

### Updated Files:
1. **`src/services/OptimizedCampaignService.ts`** - Enhanced ProjectTask interface
2. **`src/pages/OptimizedProjectDetails.tsx`** - Updated task icons and button text
3. **`src/components/nft/OptimizedNFTTaskList.tsx`** - Updated task rendering
4. **`database/add_new_campaign_task_types.sql`** - Database migration

### Key Features:
- **Type Safety**: Full TypeScript support for all task types
- **Validation**: Database constraints ensure required fields are present
- **Backward Compatibility**: Legacy task types still supported
- **Performance**: Indexed columns for efficient queries
- **Extensible**: Easy to add new task types in the future

## Usage Examples

### Creating a Twitter Follow Campaign

```typescript
const twitterFollowTask: ProjectTask = {
  id: 'task-1',
  title: 'Follow @NEFTIT on Twitter',
  description: 'Follow our official Twitter account to stay updated',
  type: 'twitter_follow',
  twitter_username: 'NEFTIT',
  action_url: 'https://twitter.com/NEFTIT',
  is_active: true,
  sort_order: 1
};
```

### Creating a Quiz Task

```typescript
const quizTask: ProjectTask = {
  id: 'task-2',
  title: 'Complete Knowledge Quiz',
  description: 'Test your understanding of NEFTIT platform',
  type: 'quiz',
  quiz_passing_score: 75,
  quiz_questions: [
    {
      question: "What is NEFTIT's main purpose?",
      options: ["Gaming", "NFT Trading", "Social Media", "Education"],
      correct_answer: 1,
      points: 25
    }
  ],
  is_active: true,
  sort_order: 2
};
```

## Migration Guide

### For New Campaigns:

1. **Deploy Database Migration**: Run `add_new_campaign_task_types.sql`
2. **Update Frontend**: Deploy updated React components
3. **Create Campaigns**: Use only the 8 supported task types
4. **Test Implementation**: Verify all task types work correctly

### Breaking Changes:

- Legacy task types (`twitter`, `discord`, `wallet`, `other`) have been removed
- Existing campaigns using legacy types will need to be updated
- Only the 8 specific task types are now supported for a cleaner system

## Best Practices

1. **Use Only Supported Types**: Only use the 8 supported task types
2. **Validate Required Fields**: Ensure all required fields are populated for each task type
3. **Test Task Completion**: Verify task completion logic works for each type
4. **User Experience**: Provide clear descriptions for each task
5. **Progressive Enhancement**: Start with basic tasks, add complex ones like quizzes later

## Support

For questions about implementing new campaign task types, refer to:
- Database schema in `database/add_new_campaign_task_types.sql`
- Frontend implementation in `src/pages/OptimizedProjectDetails.tsx`
- Service layer in `src/services/OptimizedCampaignService.ts`
