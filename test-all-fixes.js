// Complete Test for All Authentication Fixes
// Tests the full 8-method authentication system

console.log('🧪 TESTING ALL AUTHENTICATION FIXES');

async function testCompleteAuthFlow() {
  if (typeof supabase === 'undefined') {
    console.log('❌ Supabase not available. Please run this on your app page.');
    return false;
  }
  
  console.log('\n🚀 Starting Complete Authentication Flow Test...');
  
  try {
    // Test data
    const testData = {
      metamask: '0xTEST123456789012345678901234567890123456',
      phantom: 'ABC123def456ghi789jkl012mno345pqr678',
      walletconnect: '0xWC123456789012345678901234567890123456',
      sui: 'SUI123def456ghi789jkl012mno345pqr678',
      google: 'social:google:test123',
      discord: 'social:discord:test456',
      twitter: 'social:twitter:test789',
      telegram: 'social:telegram:test012'
    };
    
    console.log('\n1️⃣ Creating primary user with MetaMask...');
    
    // Create primary user with MetaMask
    const { data: primaryUser, error: createError } = await supabase.rpc('authenticate_or_create_user', {
      login_address: testData.metamask,
      login_provider: 'metamask',
      login_method: 'wallet',
      user_name: 'Primary Test User'
    });
    
    if (createError) throw createError;
    console.log('✅ Primary user created:', primaryUser[0]);
    
    const primaryUserId = primaryUser[0].user_id;
    const primaryWalletAddress = primaryUser[0].wallet_address;
    
    console.log('\n2️⃣ Linking all other 7 methods to same UUID...');
    
    // Link all other methods
    const linkingMethods = [
      { address: testData.phantom, provider: 'phantom', method: 'wallet' },
      { address: testData.walletconnect, provider: 'walletconnect', method: 'wallet' },
      { address: testData.sui, provider: 'sui', method: 'wallet' },
      { address: testData.google, provider: 'google', method: 'social', email: 'test@gmail.com' },
      { address: testData.discord, provider: 'discord', method: 'social', email: 'test@discord.com' },
      { address: testData.twitter, provider: 'twitter', method: 'social' },
      { address: testData.telegram, provider: 'telegram', method: 'social' }
    ];
    
    const linkResults = [];
    
    for (const link of linkingMethods) {
      console.log(`  🔗 Linking ${link.provider}...`);
      
      const { data: linkResult, error: linkError } = await supabase.rpc('link_additional_provider', {
        target_user_address: primaryWalletAddress,
        new_address: link.address,
        new_provider: link.provider,
        link_method: link.method,
        provider_email: link.email || null,
        provider_id: link.address.split(':')[2] || 'test'
      });
      
      if (linkError) {
        console.error(`  ❌ Failed to link ${link.provider}:`, linkError);
        linkResults.push({ provider: link.provider, success: false, error: linkError.message });
      } else {
        console.log(`  ✅ ${link.provider} linked successfully`);
        linkResults.push({ provider: link.provider, success: true });
      }
    }
    
    console.log('\n3️⃣ Testing login with each linked method...');
    
    const loginTests = [];
    
    // Test login with each method
    for (const [methodName, address] of Object.entries(testData)) {
      if (methodName === 'metamask') continue; // Skip primary method
      
      console.log(`  🚪 Testing login with ${methodName}...`);
      
      const isWallet = ['phantom', 'walletconnect', 'sui'].includes(methodName);
      
      const { data: loginResult, error: loginError } = await supabase.rpc('authenticate_or_create_user', {
        login_address: address,
        login_provider: methodName,
        login_method: isWallet ? 'wallet' : 'social',
        user_name: `${methodName} Test User`
      });
      
      if (loginError) {
        console.error(`  ❌ ${methodName} login failed:`, loginError);
        loginTests.push({ 
          method: methodName, 
          success: false, 
          error: loginError.message,
          sameUUID: false 
        });
      } else {
        const loginUserId = loginResult[0].user_id;
        const sameUUID = loginUserId === primaryUserId;
        
        console.log(`  ${sameUUID ? '✅' : '❌'} ${methodName} login - UUID ${sameUUID ? 'SAME' : 'DIFFERENT'}`);
        
        loginTests.push({ 
          method: methodName, 
          success: true, 
          sameUUID: sameUUID,
          loginUserId: loginUserId,
          isNewUser: loginResult[0].is_new_user
        });
      }
    }
    
    console.log('\n4️⃣ Checking final database state...');
    
    // Check how many users exist with our test data
    const { data: allTestUsers, error: countError } = await supabase
      .from('users')
      .select('id, wallet_address, display_name, linked_wallet_addresses, linked_social_accounts')
      .or(Object.values(testData).map(addr => `wallet_address.eq.${addr}`).join(','));
    
    if (countError) throw countError;
    
    console.log(`📊 Total users created: ${allTestUsers.length}`);
    console.log('📊 User details:', allTestUsers.map(u => ({
      id: u.id,
      primary_address: u.wallet_address,
      linked_wallets: u.linked_wallet_addresses?.length || 0,
      linked_socials: u.linked_social_accounts?.length || 0
    })));
    
    console.log('\n📋 FINAL RESULTS:');
    
    // Summary
    const successfulLinks = linkResults.filter(r => r.success).length;
    const successfulLogins = loginTests.filter(t => t.success && t.sameUUID).length;
    const totalMethods = 7; // All except primary MetaMask
    
    console.log(`✅ Linking Success Rate: ${successfulLinks}/${totalMethods} (${Math.round(successfulLinks/totalMethods*100)}%)`);
    console.log(`✅ Login Success Rate: ${successfulLogins}/${totalMethods} (${Math.round(successfulLogins/totalMethods*100)}%)`);
    console.log(`🎯 Expected Users: 1, Actual Users: ${allTestUsers.length}`);
    
    // Detailed results
    console.log('\n📊 Detailed Results:');
    console.table(linkResults);
    console.table(loginTests);
    
    // Overall success
    const overallSuccess = successfulLinks === totalMethods && 
                          successfulLogins === totalMethods && 
                          allTestUsers.length === 1;
    
    if (overallSuccess) {
      console.log('\n🎉 SUCCESS! All 8 authentication methods work with single UUID!');
      console.log('🎯 Your authentication system is working perfectly!');
    } else {
      console.log('\n⚠️ Some issues found:');
      if (successfulLinks < totalMethods) {
        console.log(`- ${totalMethods - successfulLinks} linking failures`);
      }
      if (successfulLogins < totalMethods) {
        console.log(`- ${totalMethods - successfulLogins} login failures`);
      }
      if (allTestUsers.length > 1) {
        console.log(`- ${allTestUsers.length - 1} extra users created`);
      }
    }
    
    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await supabase.from('users').delete().in('id', allTestUsers.map(u => u.id));
    console.log('✅ Test data cleaned up');
    
    return {
      success: overallSuccess,
      linkResults,
      loginTests,
      totalUsers: allTestUsers.length,
      primaryUserId
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error: error.message };
  }
}

// Quick test for current user state
function checkCurrentUserState() {
  console.log('\n📊 Current User State:');
  
  const currentState = {
    walletAddress: localStorage.getItem('walletAddress'),
    isAuthenticated: localStorage.getItem('isAuthenticated'),
    walletType: localStorage.getItem('walletType'),
    socialProvider: localStorage.getItem('socialProvider'),
    lastLogin: localStorage.getItem('lastLogin')
  };
  
  console.table(currentState);
  
  return currentState;
}

// Test specific provider linking
async function testProviderLinking(primaryAddress, newAddress, newProvider, linkMethod = 'wallet') {
  if (typeof supabase === 'undefined') {
    console.log('❌ Supabase not available');
    return false;
  }
  
  console.log(`🔗 Testing ${newProvider} linking to ${primaryAddress.substring(0, 10)}...`);
  
  try {
    const { data, error } = await supabase.rpc('link_additional_provider', {
      target_user_address: primaryAddress,
      new_address: newAddress,
      new_provider: newProvider,
      link_method: linkMethod,
      provider_email: linkMethod === 'social' ? `test@${newProvider}.com` : null,
      provider_id: 'test123'
    });
    
    if (error) throw error;
    
    console.log(`✅ ${newProvider} linking successful:`, data);
    return true;
  } catch (error) {
    console.error(`❌ ${newProvider} linking failed:`, error);
    return false;
  }
}

// Make functions available
window.testCompleteAuthFlow = testCompleteAuthFlow;
window.checkCurrentUserState = checkCurrentUserState;
window.testProviderLinking = testProviderLinking;

console.log('\n📚 Available test functions:');
console.log('- testCompleteAuthFlow() - Test complete 8-method authentication');
console.log('- checkCurrentUserState() - Check current authentication state');
console.log('- testProviderLinking(primary, new, provider, method) - Test specific linking');
console.log('\n🚀 Run: testCompleteAuthFlow()');
