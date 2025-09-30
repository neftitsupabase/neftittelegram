/**
 * NFT Count Migration Script
 * 
 * This script helps migrate existing users to the new NFT count tracking system
 * Run this after setting up the database functions
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function migrateNFTCounts() {
  try {
    console.log('🚀 Starting NFT count migration...');

    // Get all unique wallet addresses from users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('wallet_address')
      .not('wallet_address', 'is', null);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    console.log(`📊 Found ${users.length} users to migrate`);

    // Initialize counts for each user
    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        const walletAddress = user.wallet_address.toLowerCase();
        
        // Initialize with zero counts (will be updated by the tracking service)
        const { error: insertError } = await supabase
          .from('user_nft_counts')
          .upsert({
            wallet_address: walletAddress,
            offchain_nfts: 0,
            onchain_nfts: 0,
            total_nfts: 0,
            staked_nfts: 0,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'wallet_address'
          });

        if (insertError) {
          console.error(`❌ Error for ${walletAddress}:`, insertError);
          errorCount++;
        } else {
          successCount++;
          if (successCount % 10 === 0) {
            console.log(`✅ Migrated ${successCount} users...`);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing user ${user.wallet_address}:`, error);
        errorCount++;
      }
    }

    console.log(`\n🎉 Migration completed!`);
    console.log(`✅ Success: ${successCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);

    // Test the new functions
    console.log('\n🧪 Testing leaderboard functions...');
    
    const { data: leaderboard, error: leaderboardError } = await supabase
      .rpc('get_nft_leaderboard_optimized', {
        p_limit: 5,
        p_current_user_wallet: null
      });

    if (leaderboardError) {
      console.error('❌ Leaderboard test failed:', leaderboardError);
    } else {
      console.log('✅ Leaderboard function working!');
      console.log('📊 Sample results:', leaderboard);
    }

    const { data: stats, error: statsError } = await supabase
      .rpc('get_nft_statistics');

    if (statsError) {
      console.error('❌ Statistics test failed:', statsError);
    } else {
      console.log('✅ Statistics function working!');
      console.log('📈 Current stats:', stats[0]);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run migration if called directly
migrateNFTCounts()
  .then(() => {
    console.log('\n🏁 Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });

export { migrateNFTCounts };
