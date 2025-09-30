# NFT Claiming Fix Guide

## Problem
Your NFT Collection contract `0x09316BFBBb5EB271d6293dc268C39b00BfaE443D` doesn't allow public minting because it lacks proper claim conditions or minter permissions.

## Error Details
- **Error**: "Internal JSON-RPC error" when calling `mintTo()`
- **Cause**: Contract restricts minting to owner or authorized minters only
- **Chain**: Polygon Amoy Testnet (80002)

## Solutions (Choose One)

### Option 1: Deploy New NFT Drop Contract (Recommended)
Deploy a new NFT Drop contract that supports public claiming:

1. **Run deployment script:**
   ```bash
   node scripts/deploy-nft-drop-for-claims.js
   ```

2. **Update .env with new contract address:**
   ```
   VITE_THIRDWEB_CLAIMABLE_NFT_ADDRESS=<new_contract_address>
   ```

3. **Update frontend to use new contract**

### Option 2: Fix Current Contract Permissions
Set up claim conditions or grant minter role to your wallet:

1. **Run setup script:**
   ```bash
   node scripts/setup-nft-collection-claims.js
   ```

2. **This will attempt to:**
   - Set claim conditions for public minting
   - Grant minter role to your wallet
   - Verify contract ownership

### Option 3: Use Contract Owner Wallet
If you deployed the contract with a different wallet:

1. **Switch to the deployer wallet in MetaMask**
2. **The contract owner can mint without restrictions**
3. **Or transfer ownership to your current wallet**

## Current Temporary Fix
The ThirdwebNFTService now tries multiple approaches:
1. NFT Drop claim method (for contracts with claim conditions)
2. NFT Collection mintTo method (for owner/minter wallets)
3. Helpful error message if both fail

## Next Steps
1. Choose one of the solutions above
2. Test NFT claiming in the frontend
3. Verify NFTs appear in MetaMask
4. Check transaction on Polygon Amoy explorer

## Contract Details
- **Current Contract**: `0x09316BFBBb5EB271d6293dc268C39b00BfaE443D`
- **Type**: NFT Collection (ERC721)
- **Network**: Polygon Amoy Testnet
- **Issue**: Restricted minting permissions

## Verification
After implementing a fix, test by:
1. Opening Profile page
2. Clicking "Claim" on an IPFS NFT
3. Confirming MetaMask transaction
4. Checking for success toast message
5. Verifying NFT in MetaMask NFTs tab
