// URGENT FIX: Supabase Client + Linking Issues
// This will fix both the Supabase client issue and linking problems

console.log('🚨 URGENT FIX: Supabase + Linking Issues');

// STEP 1: Force load Supabase client
async function forceLoadSupabase() {
  console.log('\n🔧 Step 1: Force loading Supabase client...');
  
  try {
    // Method 1: Try direct import
    const module = await import('/src/lib/supabase.ts');
    if (module.supabase) {
      window.supabase = module.supabase;
      console.log('✅ Supabase loaded via direct import');
      return window.supabase;
    }
  } catch (e1) {
    console.log('⚠️ Direct import failed:', e1.message);
  }
  
  try {
    // Method 2: Try with @ alias
    const module = await import('@/lib/supabase');
    if (module.supabase) {
      window.supabase = module.supabase;
      console.log('✅ Supabase loaded via @ alias');
      return window.supabase;
    }
  } catch (e2) {
    console.log('⚠️ @ alias import failed:', e2.message);
  }
  
  try {
    // Method 3: Try manual creation
    const { createClient } = await import('https://cdn.skypack.dev/@supabase/supabase-js');
    
    // Try to get env vars from the page
    const scripts = Array.from(document.scripts);
    let supabaseUrl = null;
    let supabaseKey = null;
    
    // Look for env vars in script content
    scripts.forEach(script => {
      if (script.textContent) {
        const urlMatch = script.textContent.match(/VITE_SUPABASE_URL["\']:\s*["\']([^"']+)["\']/) ||
                        script.textContent.match(/supabaseUrl\s*=\s*["\']([^"']+)["\']/) ||
                        script.textContent.match(/https:\/\/[a-z]+\.supabase\.co/);
        const keyMatch = script.textContent.match(/VITE_SUPABASE_ANON_KEY["\']:\s*["\']([^"']+)["\']/) ||
                        script.textContent.match(/supabaseKey\s*=\s*["\']([^"']+)["\']/) ||
                        script.textContent.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
        
        if (urlMatch) supabaseUrl = urlMatch[1] || urlMatch[0];
        if (keyMatch) supabaseKey = keyMatch[1] || keyMatch[0];
      }
    });
    
    console.log('Environment detection:', {
      foundUrl: !!supabaseUrl,
      foundKey: !!supabaseKey,
      url: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'Not found'
    });
    
    if (supabaseUrl && supabaseKey) {
      const client = createClient(supabaseUrl, supabaseKey);
      window.supabase = client;
      console.log('✅ Supabase created manually');
      return client;
    }
  } catch (e3) {
    console.log('⚠️ Manual creation failed:', e3.message);
  }
  
  console.log('❌ All Supabase loading methods failed');
  return null;
}

// STEP 2: Test database connection and functions
async function testDatabaseSetup() {
  console.log('\n🔧 Step 2: Testing database setup...');
  
  if (!window.supabase) {
    console.log('❌ No Supabase client available');
    return false;
  }
  
  try {
    // Test basic connection
    const { data: connTest, error: connError } = await window.supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (connError) {
      console.log('❌ Database connection failed:', connError);
      return false;
    }
    
    console.log('✅ Database connection OK');
    
    // Test required functions
    const functions = ['authenticate_or_create_user', 'link_additional_provider', 'find_user_by_any_address'];
    
    for (const func of functions) {
      try {
        await window.supabase.rpc(func, {});
        console.log(`✅ Function exists: ${func}`);
      } catch (error) {
        if (error.message.includes('does not exist')) {
          console.log(`❌ Missing function: ${func}`);
          console.log('💡 You need to run database/unified_authentication_system.sql');
          return false;
        } else {
          console.log(`✅ Function exists: ${func}`);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.log('❌ Database test failed:', error);
    return false;
  }
}

// STEP 3: Test the complete linking flow
async function testLinkingFlow() {
  console.log('\n🔧 Step 3: Testing linking flow...');
  
  if (!window.supabase) {
    console.log('❌ No Supabase client');
    return false;
  }
  
  try {
    const testWallet = '0xTEST_LINKING_' + Date.now();
    const testSocial = 'social:google:test_' + Date.now();
    
    // Create primary user
    console.log('Creating primary user with wallet...');
    const { data: primaryUser, error: createError } = await window.supabase.rpc('authenticate_or_create_user', {
      login_address: testWallet,
      login_provider: 'metamask',
      login_method: 'wallet',
      user_name: 'Test Linking User'
    });
    
    if (createError) {
      console.log('❌ Primary user creation failed:', createError);
      return false;
    }
    
    console.log('✅ Primary user created:', primaryUser[0]);
    const primaryUserId = primaryUser[0].user_id;
    
    // Test linking social account
    console.log('Linking social account...');
    const { data: linkResult, error: linkError } = await window.supabase.rpc('link_additional_provider', {
      target_user_address: testWallet,
      new_address: testSocial,
      new_provider: 'google',
      link_method: 'social',
      provider_email: 'test@gmail.com',
      provider_id: 'test123'
    });
    
    if (linkError) {
      console.log('❌ Linking failed:', linkError);
      return false;
    }
    
    console.log('✅ Linking successful:', linkResult);
    
    // Test login with linked social account
    console.log('Testing login with linked social account...');
    const { data: socialLogin, error: socialLoginError } = await window.supabase.rpc('authenticate_or_create_user', {
      login_address: testSocial,
      login_provider: 'google',
      login_method: 'social',
      user_name: 'Test Social User'
    });
    
    if (socialLoginError) {
      console.log('❌ Social login failed:', socialLoginError);
      return false;
    }
    
    console.log('✅ Social login successful:', socialLogin[0]);
    
    // Check if same UUID
    const sameUser = socialLogin[0].user_id === primaryUserId;
    console.log(`${sameUser ? '✅' : '❌'} Same UUID check: ${sameUser ? 'PASS' : 'FAIL'}`);
    
    if (!sameUser) {
      console.log(`Expected: ${primaryUserId}`);
      console.log(`Got: ${socialLogin[0].user_id}`);
    }
    
    // Clean up
    await window.supabase.from('users').delete().eq('id', primaryUserId);
    if (socialLogin[0].user_id !== primaryUserId) {
      await window.supabase.from('users').delete().eq('id', socialLogin[0].user_id);
    }
    
    return sameUser;
    
  } catch (error) {
    console.log('❌ Linking flow test failed:', error);
    return false;
  }
}

// STEP 4: Check current user's linking status
async function checkCurrentUserLinking() {
  console.log('\n🔧 Step 4: Checking current user linking...');
  
  const currentWallet = localStorage.getItem('walletAddress');
  if (!currentWallet) {
    console.log('ℹ️ No current user logged in');
    return;
  }
  
  console.log('Current user wallet:', currentWallet);
  
  if (!window.supabase) {
    console.log('❌ No Supabase client');
    return;
  }
  
  try {
    // Check user in database
    const { data: userData, error: userError } = await window.supabase
      .from('users')
      .select('*')
      .eq('wallet_address', currentWallet)
      .single();
    
    if (userError) {
      console.log('❌ Current user not found in database:', userError);
      return;
    }
    
    console.log('✅ Current user found:', {
      id: userData.id,
      wallet_address: userData.wallet_address,
      display_name: userData.display_name,
      linked_wallets: userData.linked_wallet_addresses?.length || 0,
      linked_socials: userData.linked_social_accounts?.length || 0
    });
    
    if (userData.linked_wallet_addresses?.length > 0) {
      console.log('🔗 Linked wallets:', userData.linked_wallet_addresses);
    }
    
    if (userData.linked_social_accounts?.length > 0) {
      console.log('🔗 Linked socials:', userData.linked_social_accounts);
    }
    
    return userData;
    
  } catch (error) {
    console.log('❌ Current user check failed:', error);
  }
}

// MAIN FIX FUNCTION
async function fixEverything() {
  console.log('🚀 FIXING AUTHENTICATION SYSTEM...\n');
  
  // Step 1: Load Supabase
  const supabase = await forceLoadSupabase();
  if (!supabase) {
    console.log('\n❌ CRITICAL: Cannot load Supabase client');
    console.log('💡 SOLUTIONS:');
    console.log('1. Check your .env file has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    console.log('2. Restart your dev server');
    console.log('3. Make sure you\'re on the correct page (not homepage)');
    return false;
  }
  
  // Step 2: Test database
  const dbOk = await testDatabaseSetup();
  if (!dbOk) {
    console.log('\n❌ CRITICAL: Database setup incomplete');
    console.log('💡 SOLUTION: Run database/unified_authentication_system.sql in Supabase');
    return false;
  }
  
  // Step 3: Test linking
  const linkingOk = await testLinkingFlow();
  if (!linkingOk) {
    console.log('\n❌ CRITICAL: Linking system broken');
    return false;
  }
  
  // Step 4: Check current user
  await checkCurrentUserLinking();
  
  console.log('\n🎉 SUCCESS: Authentication system is working!');
  console.log('✅ You can now test linking from edit profile');
  
  return true;
}

// Quick test for linking a specific account
async function quickLinkTest(primaryWallet, newAddress, provider, method = 'social') {
  if (!window.supabase) {
    console.log('❌ No Supabase client');
    return false;
  }
  
  console.log(`🔗 Testing link: ${provider} to ${primaryWallet.substring(0, 10)}...`);
  
  try {
    const { data, error } = await window.supabase.rpc('link_additional_provider', {
      target_user_address: primaryWallet,
      new_address: newAddress,
      new_provider: provider,
      link_method: method,
      provider_email: method === 'social' ? `test@${provider}.com` : null,
      provider_id: 'test123'
    });
    
    if (error) {
      console.log('❌ Link failed:', error);
      return false;
    }
    
    console.log('✅ Link successful:', data);
    return true;
  } catch (error) {
    console.log('❌ Link error:', error);
    return false;
  }
}

// Make functions available
window.fixEverything = fixEverything;
window.forceLoadSupabase = forceLoadSupabase;
window.testLinkingFlow = testLinkingFlow;
window.checkCurrentUserLinking = checkCurrentUserLinking;
window.quickLinkTest = quickLinkTest;

console.log('\n🛠️ URGENT FIX COMMANDS:');
console.log('- fixEverything() - Complete system fix');
console.log('- forceLoadSupabase() - Just fix Supabase client');
console.log('- checkCurrentUserLinking() - Check your current user');
console.log('- quickLinkTest(wallet, address, provider, method) - Test specific link');
console.log('\n🚀 RUN NOW: fixEverything()');
