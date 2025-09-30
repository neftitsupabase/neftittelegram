// Test Script for 8-Method Authentication System
// Run this in browser console after setting up the database

console.log('🧪 Testing 8-Method Authentication System...');

// Test 1: Create a new user with MetaMask
async function testNewUserCreation() {
  console.log('\n📝 Test 1: New User Creation');
  
  try {
    const { data, error } = await supabase.rpc('authenticate_or_create_user', {
      login_address: '0x1234567890123456789012345678901234567890',
      login_provider: 'metamask',
      login_method: 'wallet',
      user_name: 'Test User MetaMask'
    });
    
    if (error) throw error;
    console.log('✅ MetaMask user created:', data[0]);
    return data[0];
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
    return null;
  }
}

// Test 2: Link Google to existing user
async function testSocialLinking(userWalletAddress) {
  console.log('\n🔗 Test 2: Social Account Linking');
  
  try {
    const { data, error } = await supabase.rpc('link_additional_provider', {
      target_user_address: userWalletAddress,
      new_address: 'social:google:test123',
      new_provider: 'google',
      link_method: 'social',
      provider_email: 'test@gmail.com',
      provider_id: 'test123'
    });
    
    if (error) throw error;
    console.log('✅ Google linked successfully:', data);
    return true;
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
    return false;
  }
}

// Test 3: Link Phantom wallet to existing user
async function testWalletLinking(userWalletAddress) {
  console.log('\n💰 Test 3: Wallet Linking');
  
  try {
    const { data, error } = await supabase.rpc('link_additional_provider', {
      target_user_address: userWalletAddress,
      new_address: 'ABC123def456ghi789jkl012mno345pqr678',
      new_provider: 'phantom',
      link_method: 'wallet'
    });
    
    if (error) throw error;
    console.log('✅ Phantom wallet linked successfully:', data);
    return true;
  } catch (error) {
    console.error('❌ Test 3 failed:', error);
    return false;
  }
}

// Test 4: Login with linked Google account
async function testLinkedAccountLogin() {
  console.log('\n🔑 Test 4: Login with Linked Account');
  
  try {
    const { data, error } = await supabase.rpc('authenticate_or_create_user', {
      login_address: 'social:google:test123',
      login_provider: 'google',
      login_method: 'social',
      user_name: 'Test User Google'
    });
    
    if (error) throw error;
    console.log('✅ Google login successful (existing user):', data[0]);
    return data[0];
  } catch (error) {
    console.error('❌ Test 4 failed:', error);
    return null;
  }
}

// Test 5: Check user connections
async function testUserConnections(userWalletAddress) {
  console.log('\n📊 Test 5: Check User Connections');
  
  try {
    const { data, error } = await supabase.rpc('get_user_connections', {
      user_wallet_address: userWalletAddress
    });
    
    if (error) throw error;
    console.log('✅ User connections retrieved:', data[0]);
    
    const connections = data[0];
    console.log('📈 Connection Summary:');
    console.log(`- Primary: ${connections.primary_wallet_address} (${connections.primary_wallet_type})`);
    console.log(`- Social Accounts: ${JSON.stringify(connections.linked_social_accounts, null, 2)}`);
    console.log(`- Wallet Addresses: ${JSON.stringify(connections.linked_wallet_addresses, null, 2)}`);
    console.log(`- Total Connections: ${connections.total_connections}`);
    
    return connections;
  } catch (error) {
    console.error('❌ Test 5 failed:', error);
    return null;
  }
}

// Test 6: Try to link already connected account (should fail)
async function testDuplicateLinking(userWalletAddress) {
  console.log('\n🚫 Test 6: Duplicate Account Linking (Should Fail)');
  
  try {
    const { data, error } = await supabase.rpc('link_additional_provider', {
      target_user_address: userWalletAddress,
      new_address: 'social:google:test123', // Same Google account
      new_provider: 'google',
      link_method: 'social'
    });
    
    if (data === false) {
      console.log('✅ Duplicate linking correctly prevented');
      return true;
    } else {
      console.error('❌ Duplicate linking should have been prevented');
      return false;
    }
  } catch (error) {
    console.log('✅ Duplicate linking correctly prevented with error:', error.message);
    return true;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Authentication System Tests...\n');
  
  // Test 1: Create new user
  const newUser = await testNewUserCreation();
  if (!newUser) {
    console.log('❌ Cannot continue tests - user creation failed');
    return;
  }
  
  const userWalletAddress = newUser.wallet_address;
  console.log(`\n👤 Using user: ${userWalletAddress}`);
  
  // Test 2: Link Google
  await testSocialLinking(userWalletAddress);
  
  // Test 3: Link Phantom
  await testWalletLinking(userWalletAddress);
  
  // Test 4: Login with Google (linked account)
  const googleLoginUser = await testLinkedAccountLogin();
  
  // Verify same UUID
  if (googleLoginUser && googleLoginUser.user_id === newUser.user_id) {
    console.log('✅ Same UUID confirmed - Google login returned same user');
  } else {
    console.error('❌ Different UUID - System not working correctly');
  }
  
  // Test 5: Check connections
  await testUserConnections(userWalletAddress);
  
  // Test 6: Try duplicate linking
  await testDuplicateLinking(userWalletAddress);
  
  console.log('\n🎉 All tests completed!');
  console.log('\n📋 Summary:');
  console.log('If all tests passed, your 8-method authentication system is working correctly!');
  console.log('Users can now:');
  console.log('- Login with any of 8 methods (4 wallets + 4 socials)');
  console.log('- Link additional accounts to same UUID');
  console.log('- Login with any linked account to access same user data');
  console.log('- See connection status in edit profile');
}

// Helper function to clean up test data
async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');
  
  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .or('wallet_address.eq.0x1234567890123456789012345678901234567890,wallet_address.eq.social:google:test123');
    
    if (error) throw error;
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Export functions for manual testing
window.testAuth = {
  runAllTests,
  testNewUserCreation,
  testSocialLinking,
  testWalletLinking,
  testLinkedAccountLogin,
  testUserConnections,
  testDuplicateLinking,
  cleanupTestData
};

console.log('📚 Test functions available:');
console.log('- testAuth.runAllTests() - Run complete test suite');
console.log('- testAuth.cleanupTestData() - Clean up test data');
console.log('- Individual test functions also available');
