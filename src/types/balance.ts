// Balance-related type definitions for NEFTIT platform

export interface UserBalance {
  total_neft_claimed: number;
  total_xp_earned: number;
  available_neft: number;
  available_xp: number;
  staked_tokens: number;
  total_nfts_owned: number;
  staked_neft: number;
  current_level: number;
  referral_neft: number;
  referral_xp: number;
  referral_count: number;
  last_updated: string;
}

export interface BalanceBreakdown {
  campaign_rewards: number;
  daily_claims: number;
  achievements: number;
  referral_rewards: number;
  staking_rewards: number;
}

export interface BalanceUpdate {
  neft_change: number;
  xp_change: number;
  nft_change: number;
  source: string;
  reason: string;
  transaction_type: 'add' | 'subtract';
}

export interface CachedBalance {
  data: UserBalance;
  timestamp: number;
  ttl: number;
}

export interface PendingUpdate {
  walletAddress: string;
  neft_change: number;
  xp_change: number;
  nft_change: number;
  source: string;
  reason: string;
  timestamp: number;
}
