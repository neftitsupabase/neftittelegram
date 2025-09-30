# ABI Files Directory

This directory contains Application Binary Interface (ABI) JSON files for smart contracts used in the NEFTIT platform.

## Structure:
- `NeftitNFT.json` - Main NFT contract ABI
- `StakingContract.json` - Staking contract ABI
- `BurnContract.json` - Burn contract ABI
- `index.ts` - Export all ABIs for easy importing

## Usage:
```typescript
import { NeftitNFTABI, StakingContractABI } from '@/abis';
```
