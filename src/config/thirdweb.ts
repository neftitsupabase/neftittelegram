import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { Polygon, PolygonAmoyTestnet } from "@thirdweb-dev/chains";

// Thirdweb configuration for NEFTIT platform
export const THIRDWEB_CONFIG = {
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID || "",
  chain: PolygonAmoyTestnet, // Use testnet for development
  contracts: {
    nftCollection: import.meta.env.VITE_THIRDWEB_NFT_COLLECTION_ADDRESS || "0x09316BFBBb5EB271d6293dc268C39b00BfaE443D", // Your deployed NFT Collection
    nftDrop: import.meta.env.VITE_THIRDWEB_NFT_DROP_ADDRESS || "0xB81782Fee0E864a13fC5141feb3CfCc08e56Aba7", // NFT Drop for claiming
    erc1155Drop: import.meta.env.VITE_THIRDWEB_ERC1155_DROP_ADDRESS || "0xb16Ab6DCEDE4C812d1A141a819B52f29722E448B", // ERC1155 Drop for multi-token claiming
    batchBurnEdition: import.meta.env.VITE_THIRDWEB_BATCH_BURN_EDITION_ADDRESS || "",
    burnToClaim: import.meta.env.VITE_THIRDWEB_BURN_TO_CLAIM_ADDRESS || "",
    nftStaking: import.meta.env.VITE_THIRDWEB_NFT_STAKING_ADDRESS || "",
    rewardToken: import.meta.env.VITE_THIRDWEB_REWARD_TOKEN_ADDRESS || "",
  },
};

// Initialize Thirdweb SDK
export const getThirdwebSDK = (signer?: any) => {
  return new ThirdwebSDK(THIRDWEB_CONFIG.chain, {
    clientId: THIRDWEB_CONFIG.clientId,
    readonlySettings: {
      rpcUrl: "https://rpc-amoy.polygon.technology", // Explicit RPC URL for Polygon Amoy
      chainId: 80002, // Polygon Amoy testnet chain ID
    },
  });
};

// NFT rarity types for NEFTIT
export enum NFTRarity {
  COMMON = "common",
  RARE = "rare", 
  PLATINUM = "platinum"
}

// Burn rules for NEFTIT platform
export const BURN_RULES = {
  [NFTRarity.COMMON]: {
    required: 5,
    result: NFTRarity.PLATINUM,
    description: "5 Common NFTs → 1 Platinum NFT"
  },
  [NFTRarity.RARE]: {
    required: 3,
    result: NFTRarity.PLATINUM,
    description: "3 Rare NFTs → 1 Platinum NFT"
  }
};

// Staking rewards configuration
export const STAKING_CONFIG = {
  // Rewards per day for each rarity
  dailyRewards: {
    [NFTRarity.COMMON]: 10, // 10 NEFT per day
    [NFTRarity.RARE]: 25,   // 25 NEFT per day
    [NFTRarity.PLATINUM]: 50 // 50 NEFT per day
  },
  
  // Time unit for rewards (1 day = 86400 seconds)
  timeUnit: 86400,
};
