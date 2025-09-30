// Shared staking types used across services and components

export interface StakingResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface StakingSummary {
  staked_nfts_count: number;
  onchain_nfts_count?: number;
  offchain_nfts_count?: number;
  staked_tokens_amount: number;
  total_pending_rewards: number;
  nft_pending_rewards?: number;
  token_pending_rewards?: number;
  daily_nft_rewards: number;
  daily_token_rewards: number;
}

export interface StakedNFT {
  id: string;
  wallet_address: string;
  nft_id: string;
  nft_rarity?: string;
  daily_reward: number;
  staked_at: string;
  last_reward_calculated?: string;
  last_reward_claim?: string;
  total_rewards_earned?: number;
  onchain?: boolean;
  onChain?: boolean;
  staking_source?: 'offchain' | 'onchain';
  stakingSource?: 'offchain' | 'onchain';
  transaction_hash?: string;
  // Add name property for filtering reward trackers
  name?: string;
  blockchain_metadata?: {
    name: string;
    image: string;
    rarity: string;
    tokenId: string;
  };
}

export interface StakedTokens {
  id: string;
  wallet_address: string;
  amount: number;
  apr_rate: number;
  daily_reward: number;
  staked_at: string;
}

export interface StakingReward {
  id: string;
  wallet_address: string;
  reward_type: 'nft_staking' | 'token_staking';
  reward_amount: number;
  reward_date: string;
  is_claimed: boolean;
}
