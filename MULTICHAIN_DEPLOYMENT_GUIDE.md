# Multichain NFT Contract Deployment Guide

## Overview
This guide covers deploying NEFTIT NFT contracts across Ethereum (Polygon Amoy), Solana (Devnet), and Sui (Testnet).

## ✅ Completed Deployments

### 1. Ethereum (Polygon Amoy Testnet)
- **Status**: ✅ COMPLETED
- **Contract**: `contracts/ethereum/NeftitNFT.sol`
- **Network**: Polygon Amoy Testnet
- **Deployment Script**: `deploy-to-amoy.js`

## 🔄 Pending Deployments

### 2. Solana (Devnet)
- **Status**: ⏳ PENDING - CLI Installation Required
- **Contract**: `contracts/solana/programs/neftit-nft/src/lib.rs`
- **Network**: Devnet
- **Deployment Script**: `contracts/solana/deploy.js` (Ready)

#### Prerequisites:
1. **Install Solana CLI**:
   ```bash
   # Windows (PowerShell as Administrator)
   cmd /c "curl https://release.solana.com/v1.16.0/solana-install-init-x86_64-pc-windows-msvc.exe --output C:\solana-install-tmp\solana-install-init.exe --create-dirs"
   C:\solana-install-tmp\solana-install-init.exe v1.16.0
   ```

2. **Install Anchor CLI**:
   ```bash
   npm install -g @coral-xyz/anchor-cli
   ```

3. **Setup Solana Wallet**:
   ```bash
   solana-keygen new --outfile ~/.config/solana/id.json
   solana config set --keypair ~/.config/solana/id.json
   solana config set --url devnet
   solana airdrop 2
   ```

#### Deployment Steps:
```bash
cd contracts/solana
node deploy.js
```

### 3. Sui (Testnet)
- **Status**: ⏳ PENDING - CLI Installation Required
- **Contract**: `contracts/sui/sources/neftit_nft.move`
- **Network**: Testnet
- **Deployment Script**: `contracts/sui/deploy.js` (Ready)

#### Prerequisites:
1. **Install Sui CLI**:
   ```bash
   # Windows (PowerShell)
   winget install sui
   # OR download from: https://github.com/MystenLabs/sui/releases
   ```

2. **Setup Sui Client**:
   ```bash
   sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
   sui client switch --env testnet
   sui client new-address ed25519
   sui client faucet
   ```

#### Deployment Steps:
```bash
cd contracts/sui
node deploy.js
```

## Environment Variables Setup

### Current Status:
```env
# Ethereum (Polygon Amoy) - ✅ DEPLOYED
VITE_ETHEREUM_NFT_CONTRACT_ADDRESS=0x742d35Cc6634C0532925a3b8D4C0C4c3e2f5d2d3
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# Solana (Devnet) - ⏳ PENDING
VITE_SOLANA_NFT_PROGRAM_ID=TBD_AFTER_DEPLOYMENT
VITE_SOLANA_NETWORK=devnet

# Sui (Testnet) - ⏳ PENDING
VITE_SUI_NFT_PACKAGE_ID=TBD_AFTER_DEPLOYMENT
VITE_SUI_NETWORK=testnet
```

## Next Steps

1. **Install Required CLIs**:
   - Solana CLI and Anchor CLI
   - Sui CLI

2. **Deploy Contracts**:
   - Run Solana deployment: `cd contracts/solana && node deploy.js`
   - Run Sui deployment: `cd contracts/sui && node deploy.js`

3. **Update Environment Variables**:
   - Add deployed contract addresses to `.env`
   - Test contract interactions

4. **Integration Testing**:
   - Test NFT claiming flow across all chains
   - Verify transaction explorer links
   - Test batch claim prevention

## Troubleshooting

### Common Issues:
1. **CLI Not Found**: Ensure CLIs are properly installed and in PATH
2. **Insufficient Funds**: Request testnet tokens from faucets
3. **Network Issues**: Check RPC endpoints and internet connection
4. **Build Errors**: Verify contract dependencies and syntax

### Support Resources:
- Solana Docs: https://docs.solana.com/
- Anchor Docs: https://www.anchor-lang.com/
- Sui Docs: https://docs.sui.io/
- Polygon Docs: https://docs.polygon.technology/

## Contract Features

All contracts support:
- NFT minting with metadata
- Rarity-based attributes
- Creator royalties
- Batch operations
- Event emission for tracking
- Access control for minting
