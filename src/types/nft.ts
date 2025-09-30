export interface NFTProject {
  id: string;
  projectName: string;
  nftName: string;
  image: string;
  endTime: string;
  startTime?: string;
  xpReward: number;
  neftReward: number;
  description: string;
  owner: string;
  totalSupply: number;
  levelRequirement: number;
  category: string;
  subcategory: string;
  taskStatus?: 'Not Started' | 'In Progress' | 'Completed';
  usdValue?: number;
  network: string;
  isOffchain: boolean; // Whether NFT is stored offline
  targetChain?: string; // The chain that the NFT will be bridged to when claimed
  claimStatus?: 'Unclaimed' | 'Claiming' | 'Claimed';
  currentParticipants?: number; // Number of current participants in the project
  maxParticipants: number;
  website?: string;
  twitter?: string;
  discord?: string;
  tasks: {
    id: string;
    title: string;
    completed: boolean;
    type?: 'twitter_follow' | 'twitter_retweet' | 'twitter_post' | 'discord_join' | 'discord_role' | 'telegram_join' | 'visit_website' | 'quiz';
    buttonState?: 0 | 1 | 2; // 0: initial completed, 1: verify, 2: final completed
    action_url?: string;
    discord_user_id?: string; // Discord user ID for role verification
    discord_guild_id?: string; // Discord server ID
    required_role_id?: string; // Required Discord role ID
    telegram_channel_id?: string; // Telegram channel ID
    website_url?: string; // Website URL to visit
    quiz_questions?: any[]; // Quiz questions array
    quiz_passing_score?: number; // Quiz passing score
    twitter_username?: string; // Twitter username to follow
    twitter_tweet_id?: string; // Twitter tweet ID to retweet
  }[];
  rarityDistribution?: {
    common: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  metadata?: {
    nft_images?: {
      common: string;
      rare: string;
      legendary: string;
    };
    [key: string]: any;
  };
}

export type NFTRarity = 'Common' | 'Rare' | 'Legendary' | 'Platinum' | 'Silver' | 'Gold';

export interface NFTStatus {
  isOffchain: boolean;
  claimStatus: 'Unclaimed' | 'Claiming' | 'Claimed';
  currentChain?: string;
  targetChain?: string;
}

export interface BurnRule {
  from: {
    rarity: NFTRarity;
    count: number;
  };
  to: {
    rarity: NFTRarity;
    count: number;
  };
}

export interface BurnHistory {
  id: string;
  timestamp: string;
  burnedNFTs: {
    id: string;
    rarity: NFTRarity;
    chain?: string;
  }[];
  receivedNFT: {
    id: string;
    rarity: NFTRarity;
    chain?: string;
  };
}

export interface ClaimHistory {
  id: string;
  timestamp: string;
  nftId: string;
  fromChain: string;
  toChain: string;
  status: 'Pending' | 'Completed' | 'Failed';
  transactionHash?: string;
}

export interface Statistic {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export interface ProcessStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  number: string;
}
