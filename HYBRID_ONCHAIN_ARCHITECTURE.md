# Hybrid On-Chain + Off-Chain Architecture for NEFTIT

## Overview
This document outlines the hybrid architecture that combines Thirdweb's audited smart contracts for on-chain operations with NEFTIT's existing off-chain systems for reward management and data tracking.

## Architecture Components

### 1. On-Chain Components (Thirdweb + Custom)

#### A. NFT Claiming - Thirdweb DropERC721
- **Purpose**: Handle NFT minting and claiming with claim conditions
- **Integration**: Replace CID pool claiming with on-chain minting
- **Benefits**: Decentralized ownership, transfer capabilities, marketplace compatibility

#### B. NFT Staking - Thirdweb StakeERC721  
- **Purpose**: Handle NFT staking/unstaking on-chain
- **Integration**: Extend EnhancedStakingService to interact with contract
- **Benefits**: Provable staking status, composability with other DeFi protocols

#### C. NFT Burning - Custom NeftitBurnUpgrade Contract
- **Purpose**: Handle NFT burning and upgrade logic on-chain
- **Integration**: Extend OptimizedCIDPoolBurnService to use contract
- **Benefits**: Immutable burn rules, transparent upgrade mechanics

### 2. Off-Chain Components (Existing Systems)

#### A. Reward Calculations (Supabase)
- **Purpose**: Calculate and distribute NEFT rewards
- **Reason**: Flexibility for complex reward logic and integration with existing systems
- **Integration**: Listen to on-chain events to trigger reward calculations

#### B. Activity Tracking & Achievements
- **Purpose**: Track user activities and manage achievement system
- **Integration**: Monitor on-chain events and update off-chain records

#### C. User Balance Management
- **Purpose**: Aggregate rewards from all sources (staking, campaigns, achievements)
- **Integration**: Include on-chain staking status in balance calculations

## Hybrid Service Architecture

### 1. Enhanced Staking Service (Hybrid)

```typescript
class HybridStakingService extends EnhancedStakingService {
  // On-chain operations
  async stakeNFTOnChain(walletAddress: string, nft: NFTData): Promise<StakingResponse>
  async unstakeNFTOnChain(walletAddress: string, tokenId: string): Promise<StakingResponse>
  
  // Off-chain reward management (existing)
  async claimRewards(walletAddress: string): Promise<StakingResponse>
  async getStakingRewards(walletAddress: string): Promise<StakingData>
  
  // Hybrid operations
  async getStakedNFTs(walletAddress: string): Promise<NFTData[]> // Read from contract
  async syncStakingStatus(walletAddress: string): Promise<void> // Sync contract state with DB
}
```

### 2. Enhanced Burn Service (Hybrid)

```typescript
class HybridBurnService extends OptimizedCIDPoolBurnService {
  // On-chain operations
  async burnNFTsOnChain(walletAddress: string, tokenIds: string[]): Promise<BurnResult>
  
  // Off-chain operations (existing)
  async burnNFTsOffChain(walletAddress: string, nftIds: string[]): Promise<BurnResult>
  
  // Hybrid operations
  async handleBurnEvent(event: BurnEvent): Promise<void> // Process on-chain burn events
  async mintUpgradedNFT(walletAddress: string, rarity: string): Promise<NFTData>
}
```

### 3. NFT Management Service (New)

```typescript
class HybridNFTService {
  // On-chain claiming (replaces CID pool claiming)
  async claimNFTOnChain(walletAddress: string, quantity: number): Promise<ClaimResult>
  
  // NFT data management
  async getUserNFTs(walletAddress: string): Promise<NFTData[]> // Read from contract
  async syncNFTMetadata(tokenId: string): Promise<void> // Sync metadata with IPFS
  
  // Integration with existing systems
  async updateNFTCounts(walletAddress: string): Promise<void>
}
```

## Integration Strategy

### Phase 1: Deploy Contracts
1. Deploy Thirdweb DropERC721 with claim conditions
2. Deploy Thirdweb StakeERC721 with dummy reward token
3. Deploy custom NeftitBurnUpgrade contract
4. Update environment variables with contract addresses

### Phase 2: Extend Existing Services
1. **EnhancedStakingService**: Add on-chain staking methods while preserving off-chain rewards
2. **OptimizedCIDPoolBurnService**: Add on-chain burning while maintaining CID pool fallback
3. **Create HybridNFTService**: Handle on-chain NFT operations

### Phase 3: Event Monitoring System
```typescript
class ContractEventMonitor {
  // Monitor staking events
  async monitorStakingEvents(): Promise<void>
  
  // Monitor burn events  
  async monitorBurnEvents(): Promise<void>
  
  // Monitor NFT transfers
  async monitorTransferEvents(): Promise<void>
  
  // Sync with off-chain systems
  async syncEventWithDatabase(event: ContractEvent): Promise<void>
}
```

### Phase 4: Frontend Integration
1. Update staking components to use hybrid service
2. Update burn components to support both on-chain and off-chain modes
3. Add transaction status tracking and confirmations
4. Maintain existing UI/UX while adding on-chain capabilities

## Data Flow Architecture

### Staking Flow (Hybrid)
1. **User Stakes NFT**: 
   - Frontend calls `HybridStakingService.stakeNFTOnChain()`
   - Service interacts with StakeERC721 contract
   - On success, update off-chain tracking in Supabase
   - Log activity and update achievements

2. **Reward Calculation**:
   - Daily batch job reads staking status from contract
   - Calculates rewards using existing off-chain logic
   - Stores rewards in `staking_rewards` table

3. **Reward Claiming**:
   - User claims rewards through existing off-chain system
   - No on-chain token transfers (NEFT remains off-chain)

### Burning Flow (Hybrid)
1. **User Burns NFTs**:
   - Frontend calls `HybridBurnService.burnNFTsOnChain()`
   - Service interacts with NeftitBurnUpgrade contract
   - Contract emits burn event with upgrade requirements

2. **Upgrade Processing**:
   - Event monitor detects burn event
   - Mints upgraded NFT through DropERC721 contract
   - Updates off-chain tracking and achievement progress

### NFT Claiming Flow (On-Chain)
1. **User Claims NFT**:
   - Frontend calls `HybridNFTService.claimNFTOnChain()`
   - Service interacts with DropERC721 contract
   - NFT minted directly to user's wallet
   - Update off-chain NFT counts and achievement progress

## Compatibility Considerations

### Backward Compatibility
- Existing off-chain operations remain functional
- CID pool system maintained as fallback for burn operations
- All existing Supabase functions and RPC calls preserved
- Current UI components work with minimal changes

### Migration Strategy
- **Gradual Migration**: Users can choose between on-chain and off-chain operations
- **Feature Flags**: Enable/disable hybrid features per user or globally
- **Data Synchronization**: Maintain consistency between on-chain state and off-chain records

### Error Handling
- **On-Chain Failures**: Fallback to off-chain operations when possible
- **Off-Chain Failures**: Continue with on-chain operations, sync later
- **State Inconsistencies**: Regular sync jobs to maintain data integrity

## Benefits of Hybrid Architecture

### For Users
- **True Ownership**: NFTs are owned on-chain, transferable and tradeable
- **Transparency**: Staking and burning operations are verifiable on blockchain
- **Flexibility**: Can interact with NFTs through external platforms
- **Existing Experience**: Familiar reward claiming and balance management

### For Platform
- **Decentralization**: Core NFT operations moved on-chain
- **Scalability**: Off-chain rewards allow complex business logic
- **Integration**: Maintains existing Supabase infrastructure and achievements
- **Upgradability**: Can enhance features without breaking existing functionality

### Technical Benefits
- **Gas Optimization**: Use Thirdweb's audited, gas-optimized contracts
- **Security**: Leverage battle-tested smart contract implementations
- **Composability**: NFTs can interact with other DeFi protocols
- **Auditability**: On-chain operations provide transparent audit trail

## Implementation Timeline

### Week 1: Contract Deployment
- Deploy and configure Thirdweb contracts
- Deploy custom burn contract
- Set up contract verification and monitoring

### Week 2: Service Extension
- Extend EnhancedStakingService with on-chain methods
- Extend OptimizedCIDPoolBurnService with on-chain methods
- Create HybridNFTService for claiming operations

### Week 3: Event Monitoring
- Implement ContractEventMonitor
- Set up event synchronization with Supabase
- Test end-to-end event processing

### Week 4: Frontend Integration
- Update React components for hybrid operations
- Add transaction status tracking
- Implement user preference for on-chain vs off-chain operations

### Week 5: Testing & Deployment
- End-to-end testing of all hybrid flows
- Performance testing and optimization
- Gradual rollout with feature flags

This hybrid architecture provides the best of both worlds: the decentralization and transparency of on-chain operations combined with the flexibility and existing infrastructure of off-chain systems.
