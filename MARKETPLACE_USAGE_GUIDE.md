# NEFTIT NFT Marketplace Integration Guide

## Overview
Your `Web3MetaMaskNFTService` now includes complete marketplace functionality allowing users to transfer, buy, and sell NFTs after minting. This guide shows you how to implement each marketplace operation.

## 🎯 Complete Marketplace Flow

### 1. **After Minting** - User Gets NFT in Wallet
```typescript
// User mints NFT (existing functionality)
const mintResult = await web3MetaMaskNFTService.mintNFT(nftId, walletAddress);
console.log('NFT minted:', mintResult.tokenId);
```

### 2. **Direct Transfer** - User to User
```typescript
// Simple transfer between users
const transferResult = await web3MetaMaskNFTService.transferNFT(
  tokenId,      // "14" (your NEFTIT #14)
  fromAddress,  // "0x123..." (current owner)
  toAddress     // "0x456..." (recipient)
);
```

### 3. **Marketplace Listing** - Approve for Sale
```typescript
// Step 1: Approve marketplace to handle the NFT
const approvalResult = await web3MetaMaskNFTService.approveNFT(
  tokenId,           // "14"
  marketplaceAddress, // "0x789..." (your marketplace contract)
  ownerAddress       // "0x123..." (NFT owner)
);

// Step 2: List on marketplace (calls your marketplace contract)
const listingResult = await web3MetaMaskNFTService.listForSale(
  tokenId,           // "14"
  ownerAddress,      // "0x123..."
  marketplaceAddress, // "0x789..."
  priceInMatic      // "0.1" (price in MATIC)
);
```

### 4. **Marketplace Purchase** - Buy NFT
```typescript
// Execute purchase through marketplace
const purchaseResult = await web3MetaMaskNFTService.executePurchase(
  tokenId,           // "14"
  sellerAddress,     // "0x123..." (current owner)
  buyerAddress,      // "0x456..." (buyer)
  priceInMatic,      // "0.1"
  marketplaceAddress // "0x789..." (marketplace contract)
);
```

## 🔧 Utility Functions

### Check NFT Information
```typescript
// Get current owner
const owner = await web3MetaMaskNFTService.getOwnerOf(tokenId);

// Get metadata URI
const tokenURI = await web3MetaMaskNFTService.getTokenURI(tokenId);

// Check if approved for marketplace
const approved = await web3MetaMaskNFTService.getApproved(tokenId);
const isApprovedForAll = await web3MetaMaskNFTService.isApprovedForAll(
  ownerAddress, 
  marketplaceAddress
);

// Get user's NFT balance
const balance = await web3MetaMaskNFTService.getBalanceOf(userAddress);
```

## 🛒 Complete Marketplace Implementation Example

```typescript
class NFTMarketplace {
  constructor() {
    this.nftService = web3MetaMaskNFTService;
  }

  // List NFT for sale
  async listNFT(tokenId: string, ownerAddress: string, priceInMatic: string) {
    try {
      // 1. Verify ownership
      const currentOwner = await this.nftService.getOwnerOf(tokenId);
      if (currentOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
        throw new Error('You do not own this NFT');
      }

      // 2. Approve marketplace (if not already approved)
      const marketplaceAddress = "YOUR_MARKETPLACE_CONTRACT_ADDRESS";
      const isApproved = await this.nftService.isApprovedForAll(
        ownerAddress, 
        marketplaceAddress
      );

      if (!isApproved) {
        await this.nftService.setApprovalForAll(
          marketplaceAddress, 
          true, 
          ownerAddress
        );
      }

      // 3. List on marketplace
      const result = await this.nftService.listForSale(
        tokenId,
        ownerAddress,
        marketplaceAddress,
        priceInMatic
      );

      console.log('✅ NFT listed successfully:', result);
      return result;

    } catch (error) {
      console.error('❌ Listing failed:', error);
      throw error;
    }
  }

  // Buy NFT from marketplace
  async buyNFT(tokenId: string, buyerAddress: string) {
    try {
      // 1. Get NFT details
      const owner = await this.nftService.getOwnerOf(tokenId);
      const tokenURI = await this.nftService.getTokenURI(tokenId);

      // 2. Execute purchase
      const marketplaceAddress = "YOUR_MARKETPLACE_CONTRACT_ADDRESS";
      const priceInMatic = "0.1"; // Get from your marketplace contract

      const result = await this.nftService.executePurchase(
        tokenId,
        owner,
        buyerAddress,
        priceInMatic,
        marketplaceAddress
      );

      console.log('✅ NFT purchased successfully:', result);
      return result;

    } catch (error) {
      console.error('❌ Purchase failed:', error);
      throw error;
    }
  }

  // Transfer NFT directly (no marketplace)
  async transferNFT(tokenId: string, fromAddress: string, toAddress: string) {
    try {
      const result = await this.nftService.transferNFT(
        tokenId,
        fromAddress,
        toAddress
      );

      console.log('✅ NFT transferred successfully:', result);
      return result;

    } catch (error) {
      console.error('❌ Transfer failed:', error);
      throw error;
    }
  }

  // Get user's NFT collection
  async getUserNFTs(userAddress: string) {
    try {
      const balance = await this.nftService.getBalanceOf(userAddress);
      const totalSupply = await this.nftService.getTotalSupply();
      
      const userNFTs = [];
      
      // Check each NFT to see if user owns it
      for (let tokenId = 1; tokenId <= totalSupply; tokenId++) {
        try {
          const owner = await this.nftService.getOwnerOf(tokenId.toString());
          if (owner.toLowerCase() === userAddress.toLowerCase()) {
            const tokenURI = await this.nftService.getTokenURI(tokenId.toString());
            userNFTs.push({
              tokenId: tokenId.toString(),
              tokenURI,
              owner
            });
          }
        } catch (error) {
          // Token might not exist, continue
          continue;
        }
      }

      return userNFTs;

    } catch (error) {
      console.error('❌ Failed to get user NFTs:', error);
      throw error;
    }
  }
}

// Usage
const marketplace = new NFTMarketplace();

// List your NEFTIT #14 for sale
await marketplace.listNFT("14", "0x123...", "0.1");

// Buy an NFT
await marketplace.buyNFT("14", "0x456...");

// Direct transfer
await marketplace.transferNFT("14", "0x123...", "0x456...");
```

## 🎨 Frontend Integration Examples

### React Component for NFT Actions
```tsx
import React, { useState } from 'react';
import { web3MetaMaskNFTService } from '../services/Web3MetaMaskNFTService';

const NFTActions = ({ tokenId, userAddress }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [transferAddress, setTransferAddress] = useState('');
  const [salePrice, setSalePrice] = useState('');

  const handleTransfer = async () => {
    setIsLoading(true);
    try {
      await web3MetaMaskNFTService.transferNFT(
        tokenId,
        userAddress,
        transferAddress
      );
      alert('NFT transferred successfully!');
    } catch (error) {
      alert(`Transfer failed: ${error.message}`);
    }
    setIsLoading(false);
  };

  const handleListForSale = async () => {
    setIsLoading(true);
    try {
      const marketplaceAddress = "YOUR_MARKETPLACE_ADDRESS";
      await web3MetaMaskNFTService.listForSale(
        tokenId,
        userAddress,
        marketplaceAddress,
        salePrice
      );
      alert('NFT listed for sale!');
    } catch (error) {
      alert(`Listing failed: ${error.message}`);
    }
    setIsLoading(false);
  };

  return (
    <div className="nft-actions">
      <h3>NFT #{tokenId} Actions</h3>
      
      {/* Transfer Section */}
      <div className="transfer-section">
        <input
          type="text"
          placeholder="Recipient address"
          value={transferAddress}
          onChange={(e) => setTransferAddress(e.target.value)}
        />
        <button 
          onClick={handleTransfer}
          disabled={isLoading || !transferAddress}
        >
          {isLoading ? 'Transferring...' : 'Transfer NFT'}
        </button>
      </div>

      {/* Sale Section */}
      <div className="sale-section">
        <input
          type="number"
          placeholder="Price in MATIC"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
        />
        <button 
          onClick={handleListForSale}
          disabled={isLoading || !salePrice}
        >
          {isLoading ? 'Listing...' : 'List for Sale'}
        </button>
      </div>
    </div>
  );
};
```

## 🔐 Security Best Practices

### 1. **Always Verify Ownership**
```typescript
const owner = await web3MetaMaskNFTService.getOwnerOf(tokenId);
if (owner.toLowerCase() !== userAddress.toLowerCase()) {
  throw new Error('You do not own this NFT');
}
```

### 2. **Check Approvals Before Operations**
```typescript
const isApproved = await web3MetaMaskNFTService.isApprovedForAll(
  ownerAddress, 
  marketplaceAddress
);
if (!isApproved) {
  // Request approval first
}
```

### 3. **Handle Transaction Errors Gracefully**
```typescript
try {
  const result = await web3MetaMaskNFTService.transferNFT(...);
} catch (error) {
  if (error.message.includes('User denied')) {
    // User cancelled transaction
  } else if (error.message.includes('insufficient funds')) {
    // Not enough MATIC for gas
  } else {
    // Other error
  }
}
```

## 🚀 Next Steps

1. **Deploy Marketplace Contract**: Create a smart contract for handling sales, royalties, and fees
2. **Add Price Discovery**: Implement bidding, auctions, or fixed-price sales
3. **Royalty System**: Use the contract's `royaltyInfo()` function for creator royalties
4. **Database Integration**: Track sales history, prices, and marketplace activity
5. **UI Components**: Build React components for listing, buying, and managing NFTs

## 📋 Available Functions Summary

| Function | Purpose | Required Permissions |
|----------|---------|---------------------|
| `mintNFT()` | Create new NFT | Contract owner only |
| `transferNFT()` | Direct transfer | NFT owner |
| `approveNFT()` | Approve specific NFT | NFT owner |
| `setApprovalForAll()` | Approve all NFTs | NFT owner |
| `transferFrom()` | Marketplace transfer | Approved address |
| `executePurchase()` | Complete purchase | Marketplace contract |
| `listForSale()` | List NFT | NFT owner |
| `getOwnerOf()` | Check ownership | Anyone |
| `getApproved()` | Check approval | Anyone |
| `isApprovedForAll()` | Check bulk approval | Anyone |
| `getTokenURI()` | Get metadata | Anyone |
| `getBalanceOf()` | Get NFT count | Anyone |
| `getTotalSupply()` | Get total NFTs | Anyone |

Your marketplace is now ready for full NFT trading functionality! 🎉
