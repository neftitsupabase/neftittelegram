// Fix Discord and X/Twitter Authentication Issues
// This will diagnose and fix the specific problems

console.log('🔧 FIXING DISCORD AND X/TWITTER AUTHENTICATION');

// Check current OAuth providers setup
async function checkOAuthProviders() {
  console.log('\n📋 Checking OAuth Provider Setup...');
  
  if (!window.supabase) {
    console.log('❌ Supabase client not available');
    return false;
  }
  
  try {
    // Test Discord OAuth initiation
    console.log('\n🔵 Testing Discord OAuth...');
    localStorage.setItem('oauth_provider', 'discord');
    localStorage.setItem('connection_mode', 'additional');
    
    const discordResult = await window.supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'identify email'
      }
    });
    
    console.log('Discord OAuth response:', discordResult);
    
    // Test X/Twitter OAuth initiation
    console.log('\n🐦 Testing X/Twitter OAuth...');
    localStorage.setItem('oauth_provider', 'twitter');
    
    const twitterResult = await window.supabase.auth.signInWithOAuth({
      provider: 'twitter',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'tweet.read users.read'
      }
    });
    
    console.log('Twitter OAuth response:', twitterResult);
    
    return true;
  } catch (error) {
    console.log('❌ OAuth provider test failed:', error);
    return false;
  }
}

// Test Discord specifically
async function testDiscordAuth() {
  console.log('\n🔵 DISCORD AUTHENTICATION TEST');
  
  if (!window.supabase) {
    console.log('❌ Supabase not available');
    return false;
  }
  
  try {
    // Set up for additional connection
    const currentWallet = localStorage.getItem('walletAddress');
    if (currentWallet) {
      localStorage.setItem('connection_mode', 'additional');
      localStorage.setItem('primary_wallet_address', currentWallet);
    }
    
    localStorage.setItem('oauth_provider', 'discord');
    
    console.log('🔵 Initiating Discord OAuth...');
    const { data, error } = await window.supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'identify email guilds'
      }
    });
    
    if (error) {
      console.log('❌ Discord OAuth error:', error);
      return false;
    }
    
    console.log('✅ Discord OAuth initiated:', data);
    console.log('💡 You should see Discord authorization window opening...');
    
    return true;
  } catch (error) {
    console.log('❌ Discord test failed:', error);
    return false;
  }
}

// Test X/Twitter specifically with new API
async function testXAuth() {
  console.log('\n🐦 X/TWITTER AUTHENTICATION TEST');
  
  if (!window.supabase) {
    console.log('❌ Supabase not available');
    return false;
  }
  
  try {
    // Set up for additional connection
    const currentWallet = localStorage.getItem('walletAddress');
    if (currentWallet) {
      localStorage.setItem('connection_mode', 'additional');
      localStorage.setItem('primary_wallet_address', currentWallet);
    }
    
    localStorage.setItem('oauth_provider', 'twitter');
    
    console.log('🐦 Initiating X/Twitter OAuth...');
    const { data, error } = await window.supabase.auth.signInWithOAuth({
      provider: 'twitter',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'tweet.read users.read offline.access'
      }
    });
    
    if (error) {
      console.log('❌ X/Twitter OAuth error:', error);
      
      // Try alternative approach for X
      console.log('🔄 Trying alternative X authentication...');
      const altResult = await window.supabase.auth.signInWithOAuth({
        provider: 'twitter',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });
      
      if (altResult.error) {
        console.log('❌ Alternative X auth also failed:', altResult.error);
        return false;
      }
      
      console.log('✅ Alternative X auth initiated:', altResult.data);
      return true;
    }
    
    console.log('✅ X/Twitter OAuth initiated:', data);
    console.log('💡 You should see X authorization window opening...');
    
    return true;
  } catch (error) {
    console.log('❌ X/Twitter test failed:', error);
    return false;
  }
}

// Check OAuth callback handling for Discord and X
function checkOAuthCallbackHandling() {
  console.log('\n🔄 CHECKING OAUTH CALLBACK HANDLING...');
  
  // Check if we're currently in a callback
  const url = window.location.href;
  const isCallback = url.includes('/auth/callback') || url.includes('access_token') || url.includes('code=');
  
  if (isCallback) {
    console.log('🔍 Currently in OAuth callback URL:', url);
    
    const urlParams = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.substring(1));
    
    console.log('URL params:', Object.fromEntries(urlParams));
    console.log('Fragment params:', Object.fromEntries(fragment));
    
    const provider = localStorage.getItem('oauth_provider');
    const connectionMode = localStorage.getItem('connection_mode');
    
    console.log('Stored OAuth state:', {
      provider,
      connectionMode,
      primaryWallet: localStorage.getItem('primary_wallet_address')
    });
    
    if (urlParams.has('error')) {
      console.log('❌ OAuth callback error:', {
        error: urlParams.get('error'),
        error_description: urlParams.get('error_description'),
        error_code: urlParams.get('error_code')
      });
    }
  } else {
    console.log('ℹ️ Not currently in OAuth callback');
  }
}

// Fix Discord OAuth configuration
async function fixDiscordOAuth() {
  console.log('\n🔧 FIXING DISCORD OAUTH CONFIGURATION...');
  
  if (!window.supabase) {
    console.log('❌ Supabase not available');
    return false;
  }
  
  // Check current user for additional connection
  const currentWallet = localStorage.getItem('walletAddress');
  
  if (currentWallet) {
    console.log('✅ Current user detected:', currentWallet);
    localStorage.setItem('connection_mode', 'additional');
    localStorage.setItem('primary_wallet_address', currentWallet);
  } else {
    console.log('ℹ️ No current user - will be primary login');
    localStorage.setItem('connection_mode', 'primary');
  }
  
  localStorage.setItem('oauth_provider', 'discord');
  
  try {
    console.log('🔵 Starting fixed Discord OAuth...');
    
    const { data, error } = await window.supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'identify email'
      }
    });
    
    if (error) {
      console.log('❌ Discord OAuth failed:', error);
      console.log('💡 Check your Supabase Discord OAuth configuration');
      console.log('💡 Make sure Discord app is set up correctly in Supabase dashboard');
      return false;
    }
    
    console.log('✅ Discord OAuth started successfully!');
    console.log('🌐 Redirecting to Discord authorization...');
    
    return true;
  } catch (error) {
    console.log('❌ Discord OAuth error:', error);
    return false;
  }
}

// Fix X/Twitter OAuth with new API requirements
async function fixXOAuth() {
  console.log('\n🔧 FIXING X/TWITTER OAUTH WITH NEW API...');
  
  if (!window.supabase) {
    console.log('❌ Supabase not available');
    return false;
  }
  
  // Check current user for additional connection
  const currentWallet = localStorage.getItem('walletAddress');
  
  if (currentWallet) {
    console.log('✅ Current user detected:', currentWallet);
    localStorage.setItem('connection_mode', 'additional');
    localStorage.setItem('primary_wallet_address', currentWallet);
  } else {
    console.log('ℹ️ No current user - will be primary login');
    localStorage.setItem('connection_mode', 'primary');
  }
  
  localStorage.setItem('oauth_provider', 'twitter');
  
  try {
    console.log('🐦 Starting fixed X/Twitter OAuth...');
    
    // Try with X-specific configuration
    const { data, error } = await window.supabase.auth.signInWithOAuth({
      provider: 'twitter',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'tweet.read users.read'
      }
    });
    
    if (error) {
      console.log('❌ X/Twitter OAuth failed:', error);
      console.log('💡 X/Twitter API may require updated configuration');
      console.log('💡 Check your Supabase Twitter OAuth settings');
      console.log('💡 Ensure you\'re using X API v2 credentials');
      return false;
    }
    
    console.log('✅ X/Twitter OAuth started successfully!');
    console.log('🌐 Redirecting to X authorization...');
    
    return true;
  } catch (error) {
    console.log('❌ X/Twitter OAuth error:', error);
    return false;
  }
}

// Diagnose OAuth issues
async function diagnoseOAuthIssues() {
  console.log('\n🔍 DIAGNOSING OAUTH ISSUES...');
  
  // Check current state
  checkOAuthCallbackHandling();
  
  // Check for common issues
  const issues = [];
  
  if (!window.supabase) {
    issues.push('Supabase client not loaded');
  }
  
  const currentWallet = localStorage.getItem('walletAddress');
  if (!currentWallet) {
    issues.push('No user logged in - cannot test additional connections');
  }
  
  // Check if we're on the right page
  if (window.location.pathname === '/') {
    issues.push('On homepage - OAuth might not work correctly');
  }
  
  if (issues.length > 0) {
    console.log('⚠️ Found issues:', issues);
  } else {
    console.log('✅ Basic checks passed');
  }
  
  return issues.length === 0;
}

// Make functions available
window.checkOAuthProviders = checkOAuthProviders;
window.testDiscordAuth = testDiscordAuth;
window.testXAuth = testXAuth;
window.fixDiscordOAuth = fixDiscordOAuth;
window.fixXOAuth = fixXOAuth;
window.diagnoseOAuthIssues = diagnoseOAuthIssues;
window.checkOAuthCallbackHandling = checkOAuthCallbackHandling;

console.log('\n🛠️ DISCORD & X/TWITTER FIX COMMANDS:');
console.log('- diagnoseOAuthIssues() - Check for common problems');
console.log('- fixDiscordOAuth() - Fix and test Discord');
console.log('- fixXOAuth() - Fix and test X/Twitter');
console.log('- checkOAuthCallbackHandling() - Check callback state');
console.log('\n🚀 TRY: fixDiscordOAuth() then fixXOAuth()');

// Auto-run diagnosis
diagnoseOAuthIssues();
