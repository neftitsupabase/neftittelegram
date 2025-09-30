// EMERGENCY DEBUG SCRIPT
// Run this immediately to find what's broken

console.log('🚨 EMERGENCY AUTHENTICATION DEBUG');

// Check if supabase is available
if (typeof supabase === 'undefined') {
  console.log('❌ CRITICAL: Supabase client not found!');
  console.log('💡 You need to be on your app page where Supabase is loaded');
  console.log('💡 Try running this on /discover or /profile page');
} else {
  console.log('✅ Supabase client found');
}

async function emergencyDiagnostic() {
  console.log('\n🔍 RUNNING EMERGENCY DIAGNOSTIC...');
  
  if (typeof supabase === 'undefined') {
    return console.log('❌ Cannot run diagnostic - Supabase not available');
  }
  
  try {
    // 1. Test basic database connection
    console.log('\n1️⃣ Testing database connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (connectionError) {
      console.log('❌ DATABASE CONNECTION FAILED:', connectionError);
      return;
    } else {
      console.log('✅ Database connection OK');
    }
    
    // 2. Check if unified functions exist
    console.log('\n2️⃣ Testing unified authentication functions...');
    
    const { data: authTest, error: authError } = await supabase.rpc('authenticate_or_create_user', {
      login_address: 'test_address_12345',
      login_provider: 'test',
      login_method: 'wallet',
      user_name: 'Test User'
    });
    
    if (authError) {
      console.log('❌ AUTHENTICATION FUNCTION MISSING/BROKEN:', authError);
      console.log('💡 You need to run the database schema files!');
      return;
    } else {
      console.log('✅ Authentication function working');
      // Clean up test user
      if (authTest && authTest[0]) {
        await supabase.from('users').delete().eq('id', authTest[0].user_id);
      }
    }
    
    // 3. Test linking function
    console.log('\n3️⃣ Testing linking function...');
    
    const { data: linkTest, error: linkError } = await supabase.rpc('find_user_by_any_address', {
      search_address: 'nonexistent_address_12345'
    });
    
    if (linkError) {
      console.log('❌ LINKING FUNCTION MISSING/BROKEN:', linkError);
      return;
    } else {
      console.log('✅ Linking function working');
    }
    
    // 4. Check current user state
    console.log('\n4️⃣ Checking current user state...');
    
    const currentState = {
      walletAddress: localStorage.getItem('walletAddress'),
      isAuthenticated: localStorage.getItem('isAuthenticated'),
      walletType: localStorage.getItem('walletType'),
      socialProvider: localStorage.getItem('socialProvider')
    };
    
    console.log('Current localStorage:', currentState);
    
    if (currentState.walletAddress) {
      console.log(`\n🔍 Looking up current user: ${currentState.walletAddress}`);
      
      const { data: currentUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', currentState.walletAddress)
        .single();
      
      if (userError) {
        console.log('❌ CURRENT USER NOT FOUND IN DATABASE:', userError);
        console.log('💡 This means your login state is out of sync');
      } else {
        console.log('✅ Current user found:', {
          id: currentUser.id,
          wallet_address: currentUser.wallet_address,
          display_name: currentUser.display_name,
          linked_wallets: currentUser.linked_wallet_addresses?.length || 0,
          linked_socials: currentUser.linked_social_accounts?.length || 0
        });
      }
    } else {
      console.log('ℹ️ No user currently logged in');
    }
    
    // 5. Test a simple authentication
    console.log('\n5️⃣ Testing simple authentication...');
    
    const testAddress = '0xTEST_DEBUG_' + Date.now();
    const { data: testAuth, error: testAuthError } = await supabase.rpc('authenticate_or_create_user', {
      login_address: testAddress,
      login_provider: 'metamask',
      login_method: 'wallet',
      user_name: 'Debug Test User'
    });
    
    if (testAuthError) {
      console.log('❌ AUTHENTICATION TEST FAILED:', testAuthError);
    } else {
      console.log('✅ Authentication test successful:', testAuth[0]);
      // Clean up
      await supabase.from('users').delete().eq('id', testAuth[0].user_id);
    }
    
    console.log('\n✅ DIAGNOSTIC COMPLETE');
    
  } catch (error) {
    console.log('❌ DIAGNOSTIC FAILED:', error);
  }
}

// Check specific error scenarios
async function checkCommonIssues() {
  console.log('\n🔍 CHECKING COMMON ISSUES...');
  
  if (typeof supabase === 'undefined') {
    return console.log('❌ Supabase not available');
  }
  
  // Issue 1: RLS policies
  console.log('\n🔒 Checking RLS policies...');
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([{
        wallet_address: 'test_rls_' + Date.now(),
        display_name: 'RLS Test User'
      }])
      .select();
    
    if (error && error.message.includes('row-level security')) {
      console.log('❌ RLS POLICY ISSUE:', error.message);
      console.log('💡 SOLUTION: Run the updated database schema with fixed RLS policies');
    } else if (error) {
      console.log('❌ INSERT ERROR:', error);
    } else {
      console.log('✅ RLS policies OK');
      // Clean up
      await supabase.from('users').delete().eq('id', data[0].id);
    }
  } catch (e) {
    console.log('❌ RLS test failed:', e);
  }
  
  // Issue 2: Missing functions
  console.log('\n⚙️ Checking required functions...');
  const requiredFunctions = ['authenticate_or_create_user', 'find_user_by_any_address', 'link_additional_provider'];
  
  for (const func of requiredFunctions) {
    try {
      // Try to call with minimal params to check existence
      await supabase.rpc(func, {});
    } catch (error) {
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.log(`❌ MISSING FUNCTION: ${func}`);
        console.log('💡 SOLUTION: Run database/unified_authentication_system.sql');
      } else {
        console.log(`✅ Function exists: ${func}`);
      }
    }
  }
}

// Quick status check
function quickStatus() {
  console.log('\n📊 QUICK STATUS CHECK:');
  
  console.log('Supabase Available:', typeof supabase !== 'undefined');
  console.log('Current URL:', window.location.href);
  console.log('Current Page:', window.location.pathname);
  
  const authData = {
    walletAddress: localStorage.getItem('walletAddress'),
    isAuthenticated: localStorage.getItem('isAuthenticated'),
    walletType: localStorage.getItem('walletType')
  };
  
  console.table(authData);
  
  // Check for common error indicators
  const errors = [];
  if (!authData.walletAddress && authData.isAuthenticated === 'true') {
    errors.push('Authentication state inconsistent');
  }
  if (typeof supabase === 'undefined') {
    errors.push('Supabase client not loaded');
  }
  
  if (errors.length > 0) {
    console.log('❌ Issues found:', errors);
  } else {
    console.log('✅ Basic checks passed');
  }
}

// Make functions available
window.emergencyDiagnostic = emergencyDiagnostic;
window.checkCommonIssues = checkCommonIssues;
window.quickStatus = quickStatus;

console.log('\n🚨 EMERGENCY DEBUG COMMANDS:');
console.log('- quickStatus() - Quick status check');
console.log('- emergencyDiagnostic() - Full diagnostic');
console.log('- checkCommonIssues() - Check common problems');
console.log('\n🚀 START WITH: quickStatus()');

// Auto-run quick status
quickStatus();
