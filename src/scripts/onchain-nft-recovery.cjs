const { Web3 } = require('web3');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = 'https://heacehinqihfexxrbwdr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlYWNlaGlucWloZmV4eHJid2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMTMyMTMsImV4cCI6MjA2Njc4OTIxM30.9jBZljJ_uS1M2gX9u3Ao_7amPwGtI9myTrdK7cBK7-4';

// Blockchain configuration
const RPC_URLS = [
    'https://rpc-amoy.polygon.technology',
    'https://polygon-amoy.drpc.org',
    'https://polygon-amoy-bor-rpc.publicnode.com'
];

const STAKING_CONTRACT_ADDRESS = '0x1F2Dbf590b1c4C96c1ddb4FF55002Dbb33DA294e';
const NFT_CONTRACT_ADDRESS = '0x8252451036797413e75338E70d294e9ed753AE64'; // Updated to correct contract

// Contract ABIs
const STAKING_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
        "name": "getStakeInfo",
        "outputs": [
            {"internalType": "uint256[]", "name": "_tokensStaked", "type": "uint256[]"},
            {"internalType": "uint256", "name": "_rewards", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "stakes",
        "outputs": [
            {"internalType": "address", "name": "owner", "type": "address"},
            {"internalType": "uint256", "name": "timestamp", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

const NFT_ABI = [
    {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "tokenURI",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "ownerOf",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }
];

class OnchainNFTRecovery {
    constructor() {
        this.web3 = null;
        this.stakingContract = null;
        this.nftContract = null;
        this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    async initialize() {
        console.log('🔧 Initializing blockchain connection...');
        
        for (const rpcUrl of RPC_URLS) {
            try {
                this.web3 = new Web3(rpcUrl);
                
                // Test connection
                const chainId = await this.web3.eth.getChainId();
                console.log(`✅ Connected to blockchain via ${rpcUrl}, Chain ID: ${chainId}`);
                
                // Initialize contracts
                this.stakingContract = new this.web3.eth.Contract(STAKING_ABI, STAKING_CONTRACT_ADDRESS);
                this.nftContract = new this.web3.eth.Contract(NFT_ABI, NFT_CONTRACT_ADDRESS);
                
                return true;
            } catch (error) {
                console.warn(`⚠️ Failed to connect to ${rpcUrl}:`, error.message);
                continue;
            }
        }
        
        throw new Error('❌ Could not connect to any RPC endpoint');
    }

    /**
     * Get all staked NFTs for a specific wallet address
     */
    async getStakedNFTsForWallet(walletAddress) {
        try {
            console.log(`\n🔍 Fetching staked NFTs for wallet: ${walletAddress}`);
            
            const checksumAddress = this.web3.utils.toChecksumAddress(walletAddress);
            const stakeInfo = await this.stakingContract.methods.getStakeInfo(checksumAddress).call();
            
            const stakedTokenIds = stakeInfo._tokensStaked || stakeInfo[0] || [];
            const pendingRewards = stakeInfo._rewards || stakeInfo[1] || '0';
            
            console.log(`📊 Found ${stakedTokenIds.length} staked NFTs`);
            console.log(`💰 Pending rewards: ${this.web3.utils.fromWei(pendingRewards, 'ether')} NEFT`);
            
            const nftDetails = [];
            
            for (const tokenId of stakedTokenIds) {
                try {
                    const nftDetail = await this.getNFTDetails(tokenId, walletAddress);
                    nftDetails.push(nftDetail);
                } catch (error) {
                    console.error(`❌ Error getting details for token ${tokenId}:`, error.message);
                    // Add minimal data even if metadata fetch fails
                    nftDetails.push({
                        tokenId: tokenId.toString(),
                        owner: walletAddress,
                        tokenURI: null,
                        metadata: null,
                        error: error.message
                    });
                }
            }
            
            return {
                walletAddress,
                stakedTokenIds: stakedTokenIds.map(id => id.toString()),
                pendingRewards: this.web3.utils.fromWei(pendingRewards, 'ether'),
                nftDetails
            };
            
        } catch (error) {
            console.error(`❌ Error fetching staked NFTs for ${walletAddress}:`, error);
            return {
                walletAddress,
                stakedTokenIds: [],
                pendingRewards: '0',
                nftDetails: [],
                error: error.message
            };
        }
    }

    /**
     * Get detailed information about a specific NFT token
     */
    async getNFTDetails(tokenId, expectedOwner) {
        try {
            console.log(`  🔍 Getting details for token ID: ${tokenId}`);
            
            // Try to get stake info - handle contract errors gracefully
            let stakeOwner = expectedOwner;
            let stakeTimestamp = Date.now() / 1000; // Default to current time
            let stakedAt = new Date().toISOString();
            
            try {
                const stakeInfo = await this.stakingContract.methods.stakes(tokenId).call();
                stakeOwner = stakeInfo.owner || stakeInfo[0] || expectedOwner;
                stakeTimestamp = stakeInfo.timestamp || stakeInfo[1] || Date.now() / 1000;
                stakedAt = new Date(parseInt(stakeTimestamp) * 1000).toISOString();
                console.log(`    ✅ Stake info retrieved for token ${tokenId}`);
            } catch (stakeError) {
                console.warn(`    ⚠️ Could not get stake details for ${tokenId}, using defaults:`, stakeError.message);
            }
            
            // Try to get token URI - handle contract errors gracefully
            let tokenURI = null;
            let metadata = null;
            
            try {
                tokenURI = await this.nftContract.methods.tokenURI(tokenId).call();
                console.log(`    📄 Token URI: ${tokenURI}`);
                
                // Try to fetch metadata
                if (tokenURI && tokenURI.startsWith('http')) {
                    const response = await fetch(tokenURI);
                    if (response.ok) {
                        metadata = await response.json();
                        console.log(`    🎨 Metadata: ${metadata.name || 'Unknown'}`);
                    }
                }
            } catch (uriError) {
                console.warn(`    ⚠️ Could not fetch token URI for ${tokenId}:`, uriError.message);
                // Create default metadata
                metadata = {
                    name: `Onchain NFT #${tokenId}`,
                    description: `Recovered onchain staked NFT with token ID ${tokenId}`,
                    attributes: [
                        { trait_type: "Rarity", value: "Common" },
                        { trait_type: "Source", value: "Onchain Recovery" }
                    ]
                };
            }
            
            return {
                tokenId: tokenId.toString(),
                stakeOwner,
                stakeTimestamp: stakeTimestamp.toString(),
                stakedAt,
                tokenURI,
                metadata,
                name: metadata?.name || `Onchain NFT #${tokenId}`,
                image: metadata?.image || null,
                rarity: metadata?.attributes?.find(attr => attr.trait_type === 'Rarity')?.value || 'Common'
            };
            
        } catch (error) {
            console.warn(`⚠️ Error getting NFT details for token ${tokenId}, creating minimal entry:`, error.message);
            
            // Return minimal data if everything fails
            return {
                tokenId: tokenId.toString(),
                stakeOwner: expectedOwner,
                stakeTimestamp: (Date.now() / 1000).toString(),
                stakedAt: new Date().toISOString(),
                tokenURI: null,
                metadata: {
                    name: `Onchain NFT #${tokenId}`,
                    description: `Recovered onchain staked NFT with token ID ${tokenId}`,
                    attributes: [{ trait_type: "Rarity", value: "Common" }]
                },
                name: `Onchain NFT #${tokenId}`,
                image: null,
                rarity: 'Common',
                error: error.message
            };
        }
    }

    /**
     * Recover staked NFTs and sync with database
     */
    async recoverAndSyncNFTs(walletAddress) {
        try {
            console.log(`\n🔄 Starting recovery and sync for wallet: ${walletAddress}`);
            
            // Get onchain staked NFTs
            const onchainData = await this.getStakedNFTsForWallet(walletAddress);
            
            if (onchainData.stakedTokenIds.length === 0) {
                console.log('ℹ️ No staked NFTs found onchain');
                return { success: true, recovered: 0, synced: 0 };
            }
            
            // Check database for existing records
            const { data: existingStakes, error: fetchError } = await this.supabase
                .from('staked_nfts')
                .select('*')
                .eq('wallet_address', walletAddress.toLowerCase())
                .eq('onchain', true);
            
            if (fetchError) {
                console.error('❌ Error fetching existing stakes:', fetchError);
            }
            
            const existingTokenIds = new Set(
                (existingStakes || []).map(stake => stake.nft_id?.replace('onchain_', ''))
            );
            
            let recovered = 0;
            let synced = 0;
            
            // Process each onchain staked NFT
            for (const nftDetail of onchainData.nftDetails) {
                const tokenId = nftDetail.tokenId;
                
                if (existingTokenIds.has(tokenId)) {
                    console.log(`✅ Token ${tokenId} already exists in database`);
                    synced++;
                    continue;
                }
                
                // Create database record for missing NFT (minimal required columns)
                const stakeRecord = {
                    nft_id: `onchain_${tokenId}`,
                    wallet_address: walletAddress.toLowerCase(),
                    nft_rarity: nftDetail.rarity,
                    daily_reward: this.calculateDailyReward(nftDetail.rarity),
                    staked_at: nftDetail.stakedAt
                };
                
                const { error: insertError } = await this.supabase
                    .from('staked_nfts')
                    .insert(stakeRecord);
                
                if (insertError) {
                    console.error(`❌ Error inserting stake record for token ${tokenId}:`, insertError);
                } else {
                    console.log(`✅ Recovered and synced token ${tokenId} to database`);
                    recovered++;
                }
            }
            
            console.log(`\n🎉 Recovery complete! Recovered: ${recovered}, Already synced: ${synced}`);
            
            return {
                success: true,
                recovered,
                synced,
                onchainData
            };
            
        } catch (error) {
            console.error('❌ Error during recovery and sync:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Calculate daily reward based on rarity
     */
    calculateDailyReward(rarity) {
        const rewards = {
            'common': 1,
            'uncommon': 2,
            'rare': 5,
            'epic': 10,
            'legendary': 20,
            'mythic': 50
        };
        
        return rewards[rarity?.toLowerCase()] || 1;
    }

    /**
     * Get all users with potential onchain stakes
     */
    async getAllUsersWithStakes() {
        try {
            const { data: users, error } = await this.supabase
                .from('users')
                .select('wallet_address')
                .not('wallet_address', 'is', null);
            
            if (error) {
                throw error;
            }
            
            return users.map(user => user.wallet_address);
        } catch (error) {
            console.error('❌ Error fetching users:', error);
            return [];
        }
    }

    /**
     * Bulk recovery for all users
     */
    async bulkRecovery() {
        console.log('🚀 Starting bulk recovery for all users...');
        
        const users = await this.getAllUsersWithStakes();
        console.log(`📊 Found ${users.length} users to check`);
        
        const results = [];
        
        for (const walletAddress of users) {
            try {
                const result = await this.recoverAndSyncNFTs(walletAddress);
                results.push({ walletAddress, ...result });
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`❌ Error processing ${walletAddress}:`, error);
                results.push({
                    walletAddress,
                    success: false,
                    error: error.message
                });
            }
        }
        
        // Summary
        const successful = results.filter(r => r.success);
        const totalRecovered = successful.reduce((sum, r) => sum + (r.recovered || 0), 0);
        const totalSynced = successful.reduce((sum, r) => sum + (r.synced || 0), 0);
        
        console.log('\n📈 BULK RECOVERY SUMMARY:');
        console.log(`✅ Successful recoveries: ${successful.length}/${results.length}`);
        console.log(`🔄 Total NFTs recovered: ${totalRecovered}`);
        console.log(`✅ Total NFTs already synced: ${totalSynced}`);
        
        return results;
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const walletAddress = args[1];
    
    const recovery = new OnchainNFTRecovery();
    
    try {
        await recovery.initialize();
        
        switch (command) {
            case 'check':
                if (!walletAddress) {
                    console.error('❌ Please provide a wallet address: node onchain-nft-recovery.cjs check 0x...');
                    return;
                }
                const stakeInfo = await recovery.getStakedNFTsForWallet(walletAddress);
                console.log('\n📊 ONCHAIN STAKE INFO:');
                console.log(JSON.stringify(stakeInfo, null, 2));
                break;
                
            case 'recover':
                if (!walletAddress) {
                    console.error('❌ Please provide a wallet address: node onchain-nft-recovery.cjs recover 0x...');
                    return;
                }
                const result = await recovery.recoverAndSyncNFTs(walletAddress);
                console.log('\n🎯 RECOVERY RESULT:');
                console.log(JSON.stringify(result, null, 2));
                break;
                
            case 'bulk':
                await recovery.bulkRecovery();
                break;
                
            default:
                console.log('📖 USAGE:');
                console.log('  node onchain-nft-recovery.cjs check 0x...     - Check staked NFTs for wallet');
                console.log('  node onchain-nft-recovery.cjs recover 0x...   - Recover and sync NFTs for wallet');
                console.log('  node onchain-nft-recovery.cjs bulk            - Bulk recovery for all users');
                break;
        }
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { OnchainNFTRecovery };
