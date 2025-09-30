#!/bin/bash

# NEFTIT Sui NFT Contract Deployment Script
# Make sure you have Sui CLI installed and configured

echo "🚀 Deploying NEFTIT NFT contract to Sui Testnet..."

# Check if Sui CLI is installed
if ! command -v sui &> /dev/null; then
    echo "❌ Sui CLI not found. Please install it first:"
    echo "cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui"
    exit 1
fi

# Switch to testnet
echo "📡 Switching to Sui testnet..."
sui client switch --env testnet

# Get current active address
ACTIVE_ADDRESS=$(sui client active-address)
echo "📍 Active address: $ACTIVE_ADDRESS"

# Check balance
echo "💰 Checking SUI balance..."
sui client gas

# Build the contract
echo "🔨 Building contract..."
sui move build

# Deploy the contract
echo "🚀 Deploying contract..."
DEPLOY_OUTPUT=$(sui client publish --gas-budget 20000000 --json)

# Extract package ID from deployment output
PACKAGE_ID=$(echo $DEPLOY_OUTPUT | jq -r '.objectChanges[] | select(.type == "published") | .packageId')
MINT_CAP_ID=$(echo $DEPLOY_OUTPUT | jq -r '.objectChanges[] | select(.objectType | contains("MintCap")) | .objectId')

echo "✅ Contract deployed successfully!"
echo "📦 Package ID: $PACKAGE_ID"
echo "🔑 Mint Cap ID: $MINT_CAP_ID"
echo "🌐 Network: Sui Testnet"

# Save deployment info
cat > deployment.json << EOF
{
  "network": "testnet",
  "packageId": "$PACKAGE_ID",
  "mintCapId": "$MINT_CAP_ID",
  "deployerAddress": "$ACTIVE_ADDRESS",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "💾 Deployment info saved to deployment.json"

# Test minting
echo "🧪 Testing NFT minting..."
sui client call \
  --package $PACKAGE_ID \
  --module neftit_nft \
  --function mint_to_sender \
  --args $MINT_CAP_ID \
         "Test NEFTIT NFT" \
         "A test NFT from NEFTIT platform" \
         "https://nftstorage.link/ipfs/bafkreiabcdefghijklmnopqrstuvwxyz123456789" \
         "common" \
  --gas-budget 10000000

echo "🎉 Deployment and testing completed!"
echo ""
echo "📋 Add these to your .env file:"
echo "VITE_SUI_PACKAGE_ID=$PACKAGE_ID"
echo "VITE_SUI_MINT_CAP_ID=$MINT_CAP_ID"
