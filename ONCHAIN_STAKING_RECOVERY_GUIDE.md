# Onchain Staking Recovery Guide

## Problem Description
When NFTs are staked onchain (on the blockchain) but the Supabase database records are accidentally deleted, the UI doesn't show them as staked. This causes:

1. ❌ NFTs appear unstaked in the UI (no lock overlay)
2. ❌ Can't unstake them through the UI
3. ❌ NFTs are actually staked on blockchain but UI doesn't know

## Solution: Recovery System

### Components Created:

1. **OnchainStakingRecoveryService.ts**
   - Detects missing database records for onchain staked NFTs
   - Syncs blockchain staking data back to Supabase database
   - Uses existing `syncExistingStakedNFTs` method from ImprovedOnchainStakingService

2. **StakingRecoveryButton.tsx**
   - UI component for easy recovery access
   - Shows missing record counts
   - One-click recovery process

3. **NFTContext Integration**
   - Automatically refreshes NFT data after recovery
   - Listens for recovery events

### How to Use:

#### Step 1: Check for Missing Records
1. Go to the **Staking page**
2. Look for the **"Recovery Tools"** section in the top-right corner
3. Click **"Check Missing Records"** button
4. The system will show:
   - How many NFTs are staked onchain
   - How many records exist in database
   - How many are missing

#### Step 2: Recover Missing Records
1. If missing records are found, click **"Recover X Records"** button
2. The system will:
   - Fetch staked NFTs from blockchain
   - Create missing database records
   - Refresh the UI automatically

#### Step 3: Verify Recovery
1. After recovery, NFTs should show:
   - ✅ Lock overlay in UI
   - ✅ "STAKED" badge
   - ✅ Can be unstaked through UI

### Technical Details:

#### Recovery Process:
```typescript
// 1. Get onchain staked NFTs from blockchain
const onchainStakedNFTs = await improvedOnchainStakingService.getStakedNFTsOnChain(walletAddress);

// 2. Get existing database records
const databaseStakedNFTs = await offChainStakingService.getStakedNFTs(walletAddress);

// 3. Find missing records
const missingNFTs = onchainStakedNFTs.filter(nft => !foundInDatabase);

// 4. Sync missing records to database
const result = await improvedOnchainStakingService.syncExistingStakedNFTs(walletAddress);
```

#### ID Mapping Enhanced:
The NFTContext now properly handles all ID variants:
- `staked_15` (from NFTLifecycleService)
- `onchain_15` (from blockchain queries)
- `15` (raw token ID)
- `blockchain_15` (alternative format)

### Troubleshooting:

#### If Recovery Doesn't Work:
1. **Check Console Logs**: Look for detailed error messages
2. **Verify Onchain Status**: Ensure NFTs are actually staked on blockchain
3. **Check RPC Connection**: Ensure blockchain connection is working
4. **Manual Database Check**: Verify `staked_nfts` table in Supabase

#### Common Issues:
1. **"Onchain staking service not available"**
   - Check if Web3 provider is connected
   - Verify contract addresses in environment variables

2. **"No missing records found"**
   - NFTs might not actually be staked onchain
   - Database records might already exist with different IDs

3. **"Recovery failed"**
   - Check Supabase permissions
   - Verify RLS policies allow the operation

### Prevention:
To avoid this issue in the future:
1. ⚠️ Don't manually delete records from `staked_nfts` table
2. ✅ Use the UI unstaking functions instead
3. ✅ Regular backups of Supabase database
4. ✅ Use the recovery system if issues occur

### Files Modified:
- `src/services/OnchainStakingRecoveryService.ts` - Recovery service
- `src/components/recovery/StakingRecoveryButton.tsx` - Recovery UI
- `src/pages/Staking.tsx` - Added recovery button
- `src/contexts/NFTContext.tsx` - Enhanced ID mapping and recovery events

### Database Tables Involved:
- `staked_nfts` - Stores staking records
- `staked_tokens` - Token staking records
- Blockchain contracts - Source of truth for onchain staking

This recovery system ensures that even if database records are accidentally deleted, users can easily restore the connection between their onchain staked NFTs and the UI display.
