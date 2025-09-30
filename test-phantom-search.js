// Test Phantom Wallet Search Issue
// This tests why Phantom creates new UUID instead of finding linked account

console.log('🔍 Testing Phantom Wallet Search Issue');

async function testPhantomSearch() {
  console.log('\n🧪 PHANTOM SEARCH TEST');
  
  if (typeof supabase === 'undefined') {
    console.log('❌ Supabase not available. Please run this on your app page.');
    return false;
  }
  
  try {
    // Test data
    const metamaskAddress = '0xTEST123456789012345678901234567890123456';
    const phantomAddress = 'ABC123def456ghi789jkl012mno345pqr678';
    
    console.log('\n1️⃣ Creating test user with MetaMask...');
    
    // Create user with MetaMask
    const { data: newUser, error: createError } = await supabase.rpc('authenticate_or_create_user', {
      login_address: metamaskAddress,
      login_provider: 'metamask',
      login_method: 'wallet',
      user_name: 'Test MetaMask User'
    });
    
    if (createError) throw createError;
    console.log('✅ MetaMask user created:', newUser[0]);
    
    const userId = newUser[0].user_id;
    
    console.log('\n2️⃣ Linking Phantom wallet to MetaMask user...');
    
    // Link Phantom wallet
    const { data: linkResult, error: linkError } = await supabase.rpc('link_additional_provider', {
      target_user_address: metamaskAddress,
      new_address: phantomAddress,
      new_provider: 'phantom',
      link_method: 'wallet'
    });
    
    if (linkError) throw linkError;
    console.log('✅ Phantom linked:', linkResult);
    
    console.log('\n3️⃣ Checking database state after linking...');
    
    // Check what's in the database
    const { data: userAfterLink, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (fetchError) throw fetchError;
    console.log('📊 User after linking:', {
      id: userAfterLink.id,
      wallet_address: userAfterLink.wallet_address,
      linked_wallet_addresses: userAfterLink.linked_wallet_addresses
    });
    
    console.log('\n4️⃣ Testing find_user_by_any_address with Phantom address...');
    
    // Test the search function
    const { data: foundUser, error: findError } = await supabase.rpc('find_user_by_any_address', {
      search_address: phantomAddress
    });
    
    if (findError) throw findError;
    
    if (foundUser && foundUser.length > 0) {
      console.log('✅ Found user by Phantom address:', foundUser[0]);
      
      if (foundUser[0].user_id === userId) {
        console.log('✅ CORRECT: Same user ID returned');
      } else {
        console.log('❌ WRONG: Different user ID returned');
        console.log(`Expected: ${userId}`);
        console.log(`Got: ${foundUser[0].user_id}`);
      }
    } else {
      console.log('❌ CRITICAL ISSUE: Phantom address not found in search!');
      console.log('This is why Phantom login creates new UUID');
      
      // Debug the search step by step
      console.log('\n🔍 Debug search step by step...');
      const { data: debugResult, error: debugError } = await supabase.rpc('debug_user_search', {
        search_address: phantomAddress
      });
      
      if (debugError) throw debugError;
      console.log('🔍 Debug search results:', debugResult);
    }
    
    console.log('\n5️⃣ Now testing authenticate_or_create_user with Phantom (this should NOT create new user)...');
    
    // This is what happens when user logs in with Phantom
    const { data: phantomLogin, error: phantomError } = await supabase.rpc('authenticate_or_create_user', {
      login_address: phantomAddress,
      login_provider: 'phantom',
      login_method: 'wallet',
      user_name: 'Test Phantom User'
    });
    
    if (phantomError) throw phantomError;
    console.log('🎯 Phantom login result:', phantomLogin[0]);
    
    const phantomLoginUserId = phantomLogin[0].user_id;
    
    if (phantomLoginUserId === userId) {
      console.log('✅ SUCCESS: Phantom login returned same UUID!');
      console.log('✅ The linking system is working correctly!');
    } else {
      console.log('❌ PROBLEM: Phantom login created NEW UUID!');
      console.log(`Original UUID: ${userId}`);
      console.log(`Phantom login UUID: ${phantomLoginUserId}`);
      console.log('❌ This means find_user_by_any_address is not finding linked wallets properly');
    }
    
    // Clean up
    console.log('\n6️⃣ Cleaning up test data...');
    await supabase.from('users').delete().or(`id.eq.${userId},id.eq.${phantomLoginUserId}`);
    console.log('✅ Test data cleaned up');
    
    return {
      success: phantomLoginUserId === userId,
      originalUserId: userId,
      phantomLoginUserId: phantomLoginUserId
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error: error.message };
  }
}

// Quick function to test current search
async function quickSearchTest(walletAddress) {
  if (typeof supabase === 'undefined') {
    console.log('❌ Supabase not available');
    return;
  }
  
  console.log(`🔍 Searching for: ${walletAddress}`);
  
  try {
    const { data, error } = await supabase.rpc('find_user_by_any_address', {
      search_address: walletAddress
    });
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      console.log('✅ Found:', data[0]);
    } else {
      console.log('❌ Not found');
    }
  } catch (error) {
    console.error('❌ Search error:', error);
  }
}

// Make functions available
window.testPhantomSearch = testPhantomSearch;
window.quickSearchTest = quickSearchTest;

console.log('\n📚 Available functions:');
console.log('- testPhantomSearch() - Test complete Phantom linking scenario');
console.log('- quickSearchTest("wallet_address") - Quick search test');
console.log('\n🚀 Run: testPhantomSearch()');
