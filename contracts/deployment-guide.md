# NEFTIT Multichain NFT Contract Deployment Guide

This guide covers deploying NEFTIT NFT contracts across Ethereum, Solana, and Sui testnets.

## Prerequisites

### General Requirements
- Node.js 18+ installed
- Git installed
- Testnet tokens for each blockchain

### Blockchain-Specific Tools

#### Ethereum (Sepolia, Polygon Mumbai, Arbitrum, Optimism)
```bash
# Install Hardhat and dependencies
cd contracts/ethereum
npm install
```

#### Solana (Devnet)
```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"

# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
```

#### Sui (Testnet)
```bash
# Install Sui CLI
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
```

## Environment Setup

Create a `.env` file in the project root:

```env
# Ethereum Networks
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
MUMBAI_RPC_URL=https://polygon-mumbai.infura.io/v3/YOUR_INFURA_KEY
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
OPTIMISM_SEPOLIA_RPC_URL=https://sepolia.optimism.io

# Private key for deployment (DO NOT COMMIT TO GIT)
PRIVATE_KEY=your_private_key_here

# API Keys for verification
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
ARBISCAN_API_KEY=your_arbiscan_api_key
OPTIMISM_API_KEY=your_optimism_api_key

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com

# Sui
SUI_RPC_URL=https://fullnode.testnet.sui.io:443

# Frontend Environment Variables (add after deployment)
VITE_ETHEREUM_NFT_CONTRACT=
VITE_POLYGON_NFT_CONTRACT=
VITE_ARBITRUM_NFT_CONTRACT=
VITE_OPTIMISM_NFT_CONTRACT=
VITE_SOLANA_PROGRAM_ID=
VITE_SUI_PACKAGE_ID=
VITE_SUI_MINT_CAP_ID=
```

## Deployment Instructions

### 1. Ethereum Contracts (Sepolia Testnet)

```bash
cd contracts/ethereum

# Compile contracts
npm run compile

# Deploy to Sepolia
npm run deploy:sepolia

# Deploy to other testnets
npm run deploy:mumbai
npm run deploy:arbitrum
npm run deploy:optimism
```

### 2. Solana Program (Devnet)

```bash
cd contracts/solana

# Configure Solana CLI for devnet
solana config set --url devnet

# Create a new keypair (if needed)
solana-keygen new --outfile ~/.config/solana/id.json

# Get devnet SOL
solana airdrop 2

# Build and deploy
anchor build
anchor deploy
```

### 3. Sui Contract (Testnet)

```bash
cd contracts/sui

# Make deploy script executable
chmod +x scripts/deploy.sh

# Run deployment
./scripts/deploy.sh
```

## Post-Deployment Configuration

### Update Environment Variables

After successful deployments, update your `.env` file with the contract addresses:

```env
# Ethereum Contracts
VITE_ETHEREUM_NFT_CONTRACT=0x1234...  # From Sepolia deployment
VITE_POLYGON_NFT_CONTRACT=0x5678...   # From Mumbai deployment
VITE_ARBITRUM_NFT_CONTRACT=0x9abc...  # From Arbitrum deployment
VITE_OPTIMISM_NFT_CONTRACT=0xdef0...  # From Optimism deployment

# Solana Program
VITE_SOLANA_PROGRAM_ID=11111111111111111111111111111111

# Sui Package
VITE_SUI_PACKAGE_ID=0x1234...
VITE_SUI_MINT_CAP_ID=0x5678...
```

### Update Frontend Services

The blockchain services are already configured to use these environment variables:

- `EthereumNFTService.ts` - Uses `VITE_ETHEREUM_NFT_CONTRACT`, etc.
- `SolanaNFTService.ts` - Uses `VITE_SOLANA_PROGRAM_ID`
- `SuiNFTService.ts` - Uses `VITE_SUI_PACKAGE_ID`

## Testing Deployment

### Install Frontend Dependencies

```bash
# Install blockchain dependencies
npm install @solana/web3.js @solana/spl-token @metaplex-foundation/js @mysten/sui.js ethers

# Start development server
npm run dev
```

### Test NFT Claiming

1. Connect wallets (MetaMask, Phantom, Sui Wallet)
2. Ensure testnet tokens in wallets
3. Navigate to Profile → My NFTs
4. Test claiming NFTs to different blockchains

## Troubleshooting

### Common Issues

1. **Insufficient Gas/Tokens**
   - Get testnet tokens from faucets
   - Increase gas limits in contracts

2. **RPC Errors**
   - Check RPC URLs in `.env`
   - Try alternative RPC providers

3. **Wallet Connection Issues**
   - Ensure wallets are on correct networks
   - Check wallet extensions are installed

### Testnet Faucets

- **Sepolia ETH**: https://sepoliafaucet.com/
- **Mumbai MATIC**: https://faucet.polygon.technology/
- **Arbitrum Sepolia**: https://bridge.arbitrum.io/
- **Optimism Sepolia**: https://app.optimism.io/faucet
- **Solana Devnet**: `solana airdrop 2`
- **Sui Testnet**: https://discord.gg/sui (request in #devnet-faucet)

## Security Notes

- Never commit private keys to version control
- Use environment variables for sensitive data
- Test thoroughly on testnets before mainnet
- Consider using hardware wallets for mainnet deployments

## Contract Verification

Contracts will be automatically verified on block explorers during deployment. Manual verification commands:

```bash
# Ethereum
npx hardhat verify --network sepolia CONTRACT_ADDRESS

# Solana programs are automatically verifiable via Anchor
# Sui contracts are automatically published with source code
```
