// Debug Script for Linking Issue
// This script will help us understand exactly what's happening

console.log('🔍 DEBUG: Linking Issue Investigation');

// Check if supabase client is available and try to find it
function ensureSupabaseClient() {
  if (typeof supabase !== 'undefined') {
    return true;
  }
  
  console.log('⚠️  Supabase client not found. Attempting to locate...');
  
  // Try to find supabase client in various places
  const possibleClients = [
    window.supabase,
    window.__SUPABASE_CLIENT__,
    window.sb,
    // Try React DevTools
    window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentOwner?.current?.memoizedProps?.supabaseClient,
    // Try to find in document
    document.querySelector('[data-supabase]')?.__supabase,
    // Check for common global variable names
    window.supabaseClient,
    window.client,
  ].filter(Boolean);
  
  if (possibleClients.length > 0) {
    window.supabase = possibleClients[0];
    console.log('✅ Found supabase client and assigned to window.supabase');
    return true;
  }
  
  // Last resort - try to find it in the page's modules
  if (typeof window.modules !== 'undefined') {
    for (const module of Object.values(window.modules)) {
      if (module.createClient && module.createClient.toString().includes('supabase')) {
        console.log('💡 Found Supabase module, but need to initialize client');
        console.log('Please run: window.supabase = supabaseModule.createClient(url, key)');
        return false;
      }
    }
  }
  
  console.log('❌ Could not find supabase client');
  console.log('💡 Solutions:');
  console.log('1. Make sure you\'re on a page with Supabase loaded (like /discover, /profile)');
  console.log('2. Or manually set: window.supabase = yourSupabaseClient');
  console.log('3. Or check browser Network tab for supabase requests to find the client');
  
  return false;
}

// Step 1: Test the scenario you described
async function debugLinkingScenario() {
  console.log('\n📋 SCENARIO TEST: Wallet First → Social Link → Social Login');
  
  if (!ensureSupabaseClient()) {
    return { success: false, error: 'Supabase client not available' };
  }
  
  const testWalletAddress = '0xDEBUG123456789012345678901234567890123456';
  const testSocialAddress = 'social:google:debug123';
  
  try {
    // 1. Create new user with wallet login
    console.log('\n1️⃣ Creating new user with wallet...');
    const { data: newUser, error: createError } = await supabase.rpc('authenticate_or_create_user', {
      login_address: testWalletAddress,
      login_provider: 'metamask',
      login_method: 'wallet',
      user_name: 'Debug Test User'
    });
    
    if (createError) throw createError;
    console.log('✅ User created:', newUser[0]);
    const userId = newUser[0].user_id;
    
    // 2. Link Google account to this user
    console.log('\n2️⃣ Linking Google account to user...');
    const { data: linkResult, error: linkError } = await supabase.rpc('link_additional_provider', {
      target_user_address: testWalletAddress,
      new_address: testSocialAddress,
      new_provider: 'google',
      link_method: 'social',
      provider_email: 'debug@test.com',
      provider_id: 'debug123'
    });
    
    if (linkError) throw linkError;
    console.log('✅ Google linked:', linkResult);
    
    // 3. Check what's stored in the database
    console.log('\n3️⃣ Checking database state...');
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (fetchError) throw fetchError;
    console.log('📊 User data after linking:', {
      id: userData.id,
      wallet_address: userData.wallet_address,
      linked_social_accounts: userData.linked_social_accounts,
      linked_wallet_addresses: userData.linked_wallet_addresses
    });
    
    // 4. Test find_user_by_any_address with the social address
    console.log('\n4️⃣ Testing find_user_by_any_address with social address...');
    const { data: foundUser, error: findError } = await supabase.rpc('find_user_by_any_address', {
      search_address: testSocialAddress
    });
    
    if (findError) throw findError;
    console.log('🔍 Found user by social address:', foundUser);
    
    // 4.5. Debug the search process step by step
    console.log('\n🔍 Debug: Step-by-step search process...');
    const { data: debugResult, error: debugError } = await supabase.rpc('debug_user_search', {
      search_address: testSocialAddress
    });
    
    if (debugError) throw debugError;
    console.log('🔍 Debug search results:', debugResult);
    
    // 5. Now try to login with the linked Google account (THIS IS WHERE THE ISSUE IS)
    console.log('\n5️⃣ 🚨 CRITICAL TEST: Login with linked Google account...');
    const { data: loginResult, error: loginError } = await supabase.rpc('authenticate_or_create_user', {
      login_address: testSocialAddress,
      login_provider: 'google',
      login_method: 'social',
      user_name: 'Debug Google User'
    });
    
    if (loginError) throw loginError;
    console.log('🎯 Login result:', loginResult[0]);
    
    // 6. Check if same UUID was returned
    const loginUserId = loginResult[0].user_id;
    if (loginUserId === userId) {
      console.log('✅ SUCCESS: Same UUID returned - linking works correctly!');
      console.log(`   Original UUID: ${userId}`);
      console.log(`   Login UUID:    ${loginUserId}`);
    } else {
      console.log('❌ PROBLEM: Different UUID returned - this is the bug!');
      console.log(`   Original UUID: ${userId}`);
      console.log(`   Login UUID:    ${loginUserId}`);
      console.log('   This means authenticate_or_create_user is not finding the linked account');
    }
    
    // 7. Check how many users exist now
    console.log('\n6️⃣ Checking total users with our test addresses...');
    const { data: allUsers, error: countError } = await supabase
      .from('users')
      .select('id, wallet_address, display_name')
      .or(`wallet_address.eq.${testWalletAddress},wallet_address.eq.${testSocialAddress}`);
    
    if (countError) throw countError;
    console.log('👥 Users with our test addresses:', allUsers);
    
    return { originalUserId: userId, loginUserId: loginUserId, success: loginUserId === userId };
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
    return { success: false, error: error.message };
  }
}

// Step 2: Clean up test data
async function cleanupDebugData() {
  console.log('\n🧹 Cleaning up debug test data...');
  
  if (!ensureSupabaseClient()) {
    console.log('⚠️ Cannot cleanup - supabase client not available');
    return;
  }
  
  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .or('wallet_address.eq.0xDEBUG123456789012345678901234567890123456,wallet_address.eq.social:google:debug123');
    
    if (error) throw error;
    console.log('✅ Debug data cleaned up');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Step 3: Test the reverse scenario
async function debugReverseLinkingScenario() {
  console.log('\n📋 REVERSE SCENARIO: Social First → Wallet Link → Wallet Login');
  
  if (!ensureSupabaseClient()) {
    return { success: false, error: 'Supabase client not available' };
  }
  
  const testSocialAddress = 'social:discord:reverse456';
  const testWalletAddress = '0xREVERSE789012345678901234567890123456789';
  
  try {
    // 1. Create user with social login
    console.log('\n1️⃣ Creating user with social login...');
    const { data: newUser, error: createError } = await supabase.rpc('authenticate_or_create_user', {
      login_address: testSocialAddress,
      login_provider: 'discord',
      login_method: 'social',
      user_name: 'Reverse Test User',
      user_email: 'reverse@test.com'
    });
    
    if (createError) throw createError;
    console.log('✅ User created:', newUser[0]);
    const userId = newUser[0].user_id;
    
    // 2. Link wallet to this user
    console.log('\n2️⃣ Linking wallet to user...');
    const { data: linkResult, error: linkError } = await supabase.rpc('link_additional_provider', {
      target_user_address: testSocialAddress,
      new_address: testWalletAddress,
      new_provider: 'metamask',
      link_method: 'wallet'
    });
    
    if (linkError) throw linkError;
    console.log('✅ Wallet linked:', linkResult);
    
    // 3. Try to login with the linked wallet
    console.log('\n3️⃣ 🚨 CRITICAL TEST: Login with linked wallet...');
    const { data: loginResult, error: loginError } = await supabase.rpc('authenticate_or_create_user', {
      login_address: testWalletAddress,
      login_provider: 'metamask',
      login_method: 'wallet',
      user_name: 'Reverse Wallet User'
    });
    
    if (loginError) throw loginError;
    console.log('🎯 Login result:', loginResult[0]);
    
    const loginUserId = loginResult[0].user_id;
    if (loginUserId === userId) {
      console.log('✅ SUCCESS: Same UUID for reverse scenario!');
    } else {
      console.log('❌ PROBLEM: Different UUID in reverse scenario!');
      console.log(`   Original UUID: ${userId}`);
      console.log(`   Login UUID:    ${loginUserId}`);
    }
    
    return { originalUserId: userId, loginUserId: loginUserId, success: loginUserId === userId };
    
  } catch (error) {
    console.error('❌ Reverse debug test failed:', error);
    return { success: false, error: error.message };
  }
}

// Step 4: Clean up reverse test data
async function cleanupReverseData() {
  console.log('\n🧹 Cleaning up reverse test data...');
  
  if (!ensureSupabaseClient()) {
    console.log('⚠️ Cannot cleanup reverse data - supabase client not available');
    return;
  }
  
  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .or('wallet_address.eq.social:discord:reverse456,wallet_address.eq.0xREVERSE789012345678901234567890123456789');
    
    if (error) throw error;
    console.log('✅ Reverse data cleaned up');
  } catch (error) {
    console.error('❌ Reverse cleanup failed:', error);
  }
}

// Main function to run all tests
async function runLinkingDebugTests() {
  console.log('🚀 Starting comprehensive linking debug tests...\n');
  
  // Test 1: Wallet first → Social link → Social login
  const test1 = await debugLinkingScenario();
  
  // Test 2: Social first → Wallet link → Wallet login  
  const test2 = await debugReverseLinkingScenario();
  
  console.log('\n📊 FINAL RESULTS:');
  console.log(`Wallet→Social→Login: ${test1.success ? '✅ WORKING' : '❌ BROKEN'}`);
  console.log(`Social→Wallet→Login: ${test2.success ? '✅ WORKING' : '❌ BROKEN'}`);
  
  if (!test1.success || !test2.success) {
    console.log('\n🔧 DIAGNOSIS:');
    console.log('The authenticate_or_create_user function is not properly checking linked accounts');
    console.log('This means find_user_by_any_address might have an issue, or the search logic needs fixing');
  } else {
    console.log('\n🎉 Both scenarios work! The linking system is functioning correctly.');
  }
  
  // Clean up
  await cleanupDebugData();
  await cleanupReverseData();
  
  return { test1, test2 };
}

// Make functions available globally
window.debugLinkingScenario = debugLinkingScenario;
window.debugReverseLinkingScenario = debugReverseLinkingScenario;
window.runLinkingDebugTests = runLinkingDebugTests;
window.cleanupDebugData = cleanupDebugData;
window.cleanupReverseData = cleanupReverseData;

console.log('📚 Debug functions available:');
console.log('- runLinkingDebugTests() - Run comprehensive linking tests');
console.log('- debugLinkingScenario() - Test wallet→social→login');
console.log('- debugReverseLinkingScenario() - Test social→wallet→login');
console.log('- cleanupDebugData() - Clean up test data');
console.log('\n🚀 Run: runLinkingDebugTests()');
