# IPFS NFT Burn System Setup Guide

## Overview
The NFT burn functionality has been completely integrated with IPFS for decentralized, off-chain storage. This system allows users to burn NFTs according to specific rules while storing all data on IPFS for immutability and decentralization.

## Burn Rules Implemented
- **5 Common → 1 Platinum**
- **3 Rare → 1 Platinum** 
- **2 Legendary → 1 Platinum**
- **5 Platinum → 1 Silver**
- **5 Silver → 1 Gold**

## Features Implemented

### ✅ Authentication & Access Control
- Only authenticated users can access burn functionality
- Wallet-based authentication using `useAuthState` hook
- Users can only see and burn their own NFTs
- Authentication required message for unauthenticated users

### ✅ IPFS Integration
- Complete IPFS backend using Pinata as the pinning service
- ERC-721 compliant metadata structure
- Automatic IPFS hash generation for all NFTs
- IPFS indicators on NFT cards
- Fallback to local images when IPFS not configured

### ✅ NFT Management
- Load user's NFTs from IPFS storage
- Seed initial NFTs for new users (10 NFTs: 5 Common, 3 Rare, 2 Legendary)
- Real-time NFT display with loading states
- Empty state handling with seed button
- Refresh functionality to reload NFTs

### ✅ Burn Functionality
- Validate burn rules before execution
- Remove burned NFTs from IPFS and UI
- Create result NFT with IPFS metadata
- Update user's collection in real-time
- Success animations and notifications
- Complete transaction history tracking

### ✅ UI/UX Features
- Preserved original design completely
- Loading states for all operations
- IPFS configuration status indicators
- Empty state with seeding options
- Real-time NFT count display
- Burn progress animations
- Success celebrations with confetti

## Setup Instructions

### 1. Environment Configuration
Copy `.env.example` to `.env` and configure the following:

```bash
# IPFS Configuration (Pinata)
VITE_PINATA_API_KEY=your_pinata_api_key_here
VITE_PINATA_SECRET_API_KEY=your_pinata_secret_api_key_here
VITE_PINATA_GATEWAY=https://gateway.pinata.cloud
```

### 2. Get Pinata API Keys
1. Go to [https://app.pinata.cloud/keys](https://app.pinata.cloud/keys)
2. Create a new API key with the following permissions:
   - `pinFileToIPFS`
   - `pinJSONToIPFS`
   - `unpin`
3. Copy the API Key and Secret API Key to your `.env` file

### 3. Test the Implementation
1. Start the development server: `npm run dev`
2. Navigate to the burn page
3. Connect your wallet
4. Click "Seed NFTs" to create initial NFTs
5. Select NFTs according to burn rules and test burning

## Technical Architecture

### Services Created
- **`IPFSService.ts`** - Core IPFS functionality using Pinata
- **`IPFSBurnService.ts`** - Complete burn system with IPFS storage

### Data Flow
1. User authenticates with wallet
2. NFTs loaded from IPFS based on wallet address
3. User selects NFTs for burning
4. System validates burn rules
5. Burned NFTs deleted from IPFS
6. Result NFT created and stored on IPFS
7. UI updated with new collection

### Storage Structure
Each NFT is stored as ERC-721 compliant metadata on IPFS:
```json
{
  "name": "NFT Name",
  "description": "NFT Description",
  "image": "ipfs://hash_or_url",
  "attributes": [
    {"trait_type": "Rarity", "value": "Common"},
    {"trait_type": "Tier", "value": 1},
    {"trait_type": "Collection", "value": "Project"},
    {"trait_type": "Burn Value", "value": 50}
  ]
}
```

## Benefits

### 🔒 Decentralization
- No single point of failure
- Immutable NFT records
- User owns their data

### 💰 Cost Efficiency
- ~$0.15/GB/month for IPFS pinning
- No ongoing database costs
- Reduced server load

### 🛡️ Security
- Wallet-based authentication
- User-specific data access
- Immutable transaction history

### 🎯 Standards Compliance
- ERC-721 metadata format
- Marketplace compatible
- Standard token URIs

## Troubleshooting

### IPFS Not Configured Warning
If you see "IPFS Not Configured" warning:
1. Check your `.env` file has the Pinata keys
2. Restart the development server
3. Verify API keys are correct

### No NFTs Found
If no NFTs appear:
1. Click "Seed NFTs" to create initial collection
2. Check wallet is properly connected
3. Verify authentication status

### Burn Fails
If burning fails:
1. Check you have the correct number of NFTs for the rule
2. Verify IPFS configuration
3. Check console for error messages

## Next Steps
- The system is ready for production use
- Consider adding more burn rules as needed
- Monitor IPFS costs and optimize as necessary
- Add more NFT rarities and tiers as the project grows
