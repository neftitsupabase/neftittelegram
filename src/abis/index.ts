// ABI exports for NEFTIT smart contracts
export { default as NFTStakeABI } from './NFTStake.json';
export { default as ERC721ABI } from './ERC721.json';

// Type definitions for ABIs
export type ContractABI = any[];

// Contract addresses for Polygon Amoy network
export const CONTRACT_ADDRESSES = {
  NFT_CONTRACT: process.env.VITE_NFT_CLAIM_CONTRACT_ADDRESS || '0x5Bb23220cC12585264fCd144C448eF222c8572A2',
  STAKING_CONTRACT: process.env.VITE_STAKING_CONTRACT_ADDRESS || '0x1F2Dbf590b1c4C96c1ddb4FF55002Dbb33DA294e',
} as const;

// Network configuration for Polygon Amoy
export const NETWORK_CONFIG = {
  CHAIN_ID: 80002, // Polygon Amoy testnet
  RPC_URL: process.env.VITE_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology/',
  NETWORK_NAME: 'Polygon Amoy',
  CURRENCY_SYMBOL: 'MATIC',
  BLOCK_EXPLORER: 'https://amoy.polygonscan.com/',
} as const;
