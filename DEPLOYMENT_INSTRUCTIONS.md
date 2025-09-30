# Multichain NFT Contract Deployment Instructions

## Prerequisites

1. **Install Dependencies**
   ```bash
   # Root project dependencies
   npm install @solana/web3.js @solana/spl-token @metaplex-foundation/js
   
   # Ethereum contract dependencies
   cd contracts/ethereum
   npm install
   
   # Solana program dependencies
   cd ../solana
   cargo build-bpf
   
   # Sui contract dependencies
   cd ../sui
   sui move build
   ```

2. **Environment Setup**
   - Get Sepolia ETH from faucet: https://sepoliafaucet.com/
   - Get Solana SOL from faucet: https://faucet.solana.com/
   - Get Sui tokens from faucet: https://discord.gg/sui

## Ethereum Contract Deployment (Sepolia)

1. **Compile Contract**
   ```bash
   cd contracts/ethereum
   npx hardhat compile
   ```

2. **Deploy to Sepolia**
   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   ```

3. **Verify Contract (Optional)**
   ```bash
   npx hardhat verify --network sepolia <CONTRACT_ADDRESS> "NEFTIT NFT" "NEFT"
   ```

## Solana Program Deployment (Devnet)

1. **Build Program**
   ```bash
   cd contracts/solana
   anchor build
   ```

2. **Deploy to Devnet**
   ```bash
   anchor deploy --provider.cluster devnet
   ```

3. **Update Anchor.toml with Program ID**

## Sui Contract Deployment (Testnet)

1. **Build Contract**
   ```bash
   cd contracts/sui
   sui move build
   ```

2. **Deploy to Testnet**
   ```bash
   sui client publish --gas-budget 20000000
   ```

3. **Extract Package ID and Mint Cap ID from deployment output**

## Environment Variable Updates

After deployment, update `.env` file:

```env
# Ethereum
VITE_ETHEREUM_NFT_CONTRACT_ADDRESS=0x...

# Solana  
VITE_SOLANA_PROGRAM_ID=...

# Sui
VITE_SUI_PACKAGE_ID=0x...
VITE_SUI_MINT_CAP_ID=0x...
```

## Testing

1. **Test Ethereum Minting**
   ```bash
   cd contracts/ethereum
   npx hardhat run scripts/test-mint.js --network sepolia
   ```

2. **Test Solana Minting**
   ```bash
   cd contracts/solana
   anchor test --provider.cluster devnet
   ```

3. **Test Sui Minting**
   ```bash
   cd contracts/sui
   sui client call --function mint --module neftit_nft --package <PACKAGE_ID>
   ```

## Frontend Integration

After deployment, the frontend services will automatically use the contract addresses from environment variables:

- `EthereumNFTService.ts` - Uses `VITE_ETHEREUM_NFT_CONTRACT_ADDRESS`
- `SolanaNFTService.ts` - Uses `VITE_SOLANA_PROGRAM_ID`  
- `SuiNFTService.ts` - Uses `VITE_SUI_PACKAGE_ID` and `VITE_SUI_MINT_CAP_ID`

## Troubleshooting

1. **Insufficient Funds**: Get testnet tokens from faucets
2. **RPC Errors**: Check RPC URLs in `.env` file
3. **Contract Verification**: Ensure API keys are set correctly
4. **Gas Estimation**: Increase gas limits if transactions fail
