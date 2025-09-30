import { supabase } from '@/lib/supabase';

/**
 * Test script to verify badge database functionality
 * Run this in the browser console to debug badge issues
 */
export async function testBadgeDatabase(walletAddress: string) {
  console.log('🧪 Testing Badge Database for wallet:', walletAddress);
  
  try {
    // 1. Test if users table exists and has the claimed_badges column
    console.log('\n1️⃣ Testing users table structure...');
    
    const { data: tableInfo, error: tableError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Users table error:', tableError);
      return;
    }
    
    console.log('✅ Users table accessible');
    console.log('📋 Sample user data:', tableInfo?.[0]);
    
    // 2. Test if claimed_badges column exists
    console.log('\n2️⃣ Testing claimed_badges column...');
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('claimed_badges')
      .eq('wallet_address', walletAddress)
      .single();
    
    if (userError) {
      if (userError.code === '42703') {
        console.error('❌ claimed_badges column does not exist!');
        console.log('💡 Solution: Run the SQL script: database/add_claimed_badges_column.sql');
        console.log('💡 Or manually add: ALTER TABLE users ADD COLUMN claimed_badges JSONB DEFAULT \'[]\'::jsonb;');
      } else {
        console.error('❌ Error fetching user data:', userError);
      }
      return;
    }
    
    console.log('✅ claimed_badges column exists');
    console.log('📋 Current claimed badges:', userData?.claimed_badges);
    
    // 3. Test updating claimed badges
    console.log('\n3️⃣ Testing badge update...');
    
    const testBadgeId = 'test-badge-' + Date.now();
    const currentBadges = userData?.claimed_badges || [];
    const updatedBadges = [...currentBadges, testBadgeId];
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        claimed_badges: updatedBadges,
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', walletAddress);
    
    if (updateError) {
      console.error('❌ Update test failed:', updateError);
      return;
    }
    
    console.log('✅ Badge update test successful');
    
    // 4. Verify the update
    console.log('\n4️⃣ Verifying update...');
    
    const { data: verifyData, error: verifyError } = await supabase
      .from('users')
      .select('claimed_badges')
      .eq('wallet_address', walletAddress)
      .single();
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
      return;
    }
    
    console.log('✅ Verification successful');
    console.log('📋 Updated claimed badges:', verifyData?.claimed_badges);
    
    // 5. Clean up test data
    console.log('\n5️⃣ Cleaning up test data...');
    
    const { error: cleanupError } = await supabase
      .from('users')
      .update({ 
        claimed_badges: currentBadges,
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', walletAddress);
    
    if (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError);
    } else {
      console.log('✅ Cleanup successful');
    }
    
    console.log('\n🎉 Badge database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

/**
 * Quick function to add the claimed_badges column
 * Note: This requires appropriate database permissions
 */
export async function addClaimedBadgesColumn() {
  console.log('🔧 Attempting to add claimed_badges column...');
  
  try {
    // This is a simplified approach - in practice, you'd run the SQL script
    console.log('⚠️ This function cannot directly alter database schema');
    console.log('💡 Please run the SQL script: database/add_claimed_badges_column.sql');
    console.log('💡 Or manually execute: ALTER TABLE users ADD COLUMN claimed_badges JSONB DEFAULT \'[]\'::jsonb;');
    
  } catch (error) {
    console.error('❌ Failed to add column:', error);
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testBadgeDatabase = testBadgeDatabase;
  (window as any).addClaimedBadgesColumn = addClaimedBadgesColumn;
}
