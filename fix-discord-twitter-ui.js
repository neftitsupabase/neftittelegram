// COMPREHENSIVE FIX: Discord, Twitter, and UI Issues
// This will fix all the specific problems you mentioned

console.log('🔧 FIXING DISCORD, TWITTER & UI ISSUES');

// Fix Discord OAuth callback processing
async function fixDiscordCallback() {
  console.log('\n🔵 FIXING DISCORD CALLBACK PROCESSING...');
  
  if (!window.supabase) {
    console.log('❌ Supabase not available');
    return false;
  }
  
  // Check if we're in a Discord callback
  const url = window.location.href;
  const isCallback = url.includes('/auth/callback');
  const provider = localStorage.getItem('oauth_provider');
  
  if (isCallback && provider === 'discord') {
    console.log('🔍 Processing Discord callback...');
    
    try {
      // Get the current session
      const { data: sessionData, error: sessionError } = await window.supabase.auth.getSession();
      
      if (sessionError) {
        console.log('❌ Session error:', sessionError);
        return false;
      }
      
      if (!sessionData.session) {
        console.log('❌ No session found');
        return false;
      }
      
      console.log('✅ Discord session found:', sessionData.session.user);
      
      const user = sessionData.session.user;
      const identity = user.identities?.[0];
      
      if (!identity) {
        console.log('❌ No identity found');
        return false;
      }
      
      console.log('✅ Discord identity:', identity);
      
      // Extract Discord data
      const discordData = {
        provider: identity.provider,
        id: identity.id,
        username: identity.identity_data?.username || identity.identity_data?.global_name,
        discriminator: identity.identity_data?.discriminator,
        email: user.email,
        avatar: identity.identity_data?.avatar_url
      };
      
      console.log('🔵 Discord user data:', discordData);
      
      // Create social address
      const socialAddress = `social:discord:${identity.id}`;
      
      // Check connection mode
      const connectionMode = localStorage.getItem('connection_mode');
      const primaryWallet = localStorage.getItem('primary_wallet_address');
      
      if (connectionMode === 'additional' && primaryWallet) {
        console.log('🔗 Linking Discord to existing account...');
        
        // Link to existing user
        const { data: linkResult, error: linkError } = await window.supabase.rpc('link_additional_provider', {
          target_user_address: primaryWallet,
          new_address: socialAddress,
          new_provider: 'discord',
          link_method: 'social',
          provider_email: user.email,
          provider_id: identity.id
        });
        
        if (linkError) {
          console.log('❌ Discord linking failed:', linkError);
          return false;
        }
        
        console.log('✅ Discord linked successfully:', linkResult);
        
        // Clean up
        localStorage.removeItem('connection_mode');
        localStorage.removeItem('primary_wallet_address');
        localStorage.removeItem('oauth_provider');
        
        // Show success message
        alert('Discord account linked successfully!');
        
        // Redirect to edit profile
        window.location.href = '/edit-profile';
        
        return true;
      } else {
        console.log('🆕 Creating new user with Discord...');
        
        // Create new user
        const { data: authResult, error: authError } = await window.supabase.rpc('authenticate_or_create_user', {
          login_address: socialAddress,
          login_provider: 'discord',
          login_method: 'social',
          user_email: user.email,
          user_name: discordData.username || 'Discord User',
          user_avatar: discordData.avatar
        });
        
        if (authError) {
          console.log('❌ Discord auth failed:', authError);
          return false;
        }
        
        console.log('✅ Discord user created:', authResult[0]);
        
        // Set up localStorage
        localStorage.setItem('walletAddress', socialAddress);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('walletType', 'social');
        localStorage.setItem('socialProvider', 'discord');
        
        // Redirect to discover
        window.location.href = '/discover';
        
        return true;
      }
      
    } catch (error) {
      console.log('❌ Discord callback processing failed:', error);
      return false;
    }
  }
  
  return false;
}

// Fix Twitter OAuth issues
async function fixTwitterOAuth() {
  console.log('\n🐦 FIXING TWITTER OAUTH ISSUES...');
  
  if (!window.supabase) {
    console.log('❌ Supabase not available');
    return false;
  }
  
  // Clear any existing OAuth state
  localStorage.removeItem('oauth_provider');
  localStorage.removeItem('connection_mode');
  localStorage.removeItem('primary_wallet_address');
  
  // Set up for Twitter connection
  const currentWallet = localStorage.getItem('walletAddress');
  
  if (currentWallet) {
    console.log('✅ Setting up additional Twitter connection...');
    localStorage.setItem('connection_mode', 'additional');
    localStorage.setItem('primary_wallet_address', currentWallet);
  }
  
  localStorage.setItem('oauth_provider', 'twitter');
  
  try {
    console.log('🐦 Starting improved Twitter OAuth...');
    
    // Use improved Twitter OAuth configuration
    const { data, error } = await window.supabase.auth.signInWithOAuth({
      provider: 'twitter',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'tweet.read users.read',
        queryParams: {
          'user.fields': 'id,name,username,profile_image_url'
        }
      }
    });
    
    if (error) {
      console.log('❌ Twitter OAuth error:', error);
      
      // Try alternative method
      console.log('🔄 Trying alternative Twitter OAuth...');
      
      const altData = await window.supabase.auth.signInWithOAuth({
        provider: 'twitter',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (altData.error) {
        console.log('❌ Alternative Twitter OAuth failed:', altData.error);
        alert('Twitter/X authentication is currently unavailable. Please try another method.');
        return false;
      }
      
      console.log('✅ Alternative Twitter OAuth started');
      return true;
    }
    
    console.log('✅ Twitter OAuth started successfully');
    console.log('🌐 Redirecting to Twitter...');
    
    return true;
    
  } catch (error) {
    console.log('❌ Twitter OAuth failed:', error);
    alert('Twitter/X authentication failed. This may be due to API changes.');
    return false;
  }
}

// Test specific linking
async function testDiscordLinking() {
  console.log('\n🔵 TESTING DISCORD LINKING...');
  
  const currentWallet = localStorage.getItem('walletAddress');
  
  if (!currentWallet) {
    console.log('❌ No current user logged in');
    return false;
  }
  
  if (!window.supabase) {
    console.log('❌ Supabase not available');
    return false;
  }
  
  try {
    // Test linking with fake Discord data
    const testDiscordAddress = 'social:discord:test_' + Date.now();
    
    const { data, error } = await window.supabase.rpc('link_additional_provider', {
      target_user_address: currentWallet,
      new_address: testDiscordAddress,
      new_provider: 'discord',
      link_method: 'social',
      provider_email: 'test@discord.com',
      provider_id: 'test123'
    });
    
    if (error) {
      console.log('❌ Discord linking test failed:', error);
      return false;
    }
    
    console.log('✅ Discord linking test successful:', data);
    
    // Clean up test data
    await window.supabase.from('users').select('*').eq('wallet_address', currentWallet).single()
      .then(({ data: userData }) => {
        if (userData?.linked_social_accounts) {
          const filtered = userData.linked_social_accounts.filter(acc => !acc.social_address?.includes('test_'));
          return window.supabase.from('users').update({ linked_social_accounts: filtered }).eq('id', userData.id);
        }
      });
    
    return true;
    
  } catch (error) {
    console.log('❌ Discord linking test error:', error);
    return false;
  }
}

// Check current user's connections
async function checkUserConnections() {
  console.log('\n📊 CHECKING CURRENT USER CONNECTIONS...');
  
  const currentWallet = localStorage.getItem('walletAddress');
  
  if (!currentWallet) {
    console.log('ℹ️ No user logged in');
    return null;
  }
  
  if (!window.supabase) {
    console.log('❌ Supabase not available');
    return null;
  }
  
  try {
    const { data: userData, error } = await window.supabase
      .from('users')
      .select('*')
      .eq('wallet_address', currentWallet)
      .single();
    
    if (error) {
      console.log('❌ User not found:', error);
      return null;
    }
    
    console.log('✅ Current user found:', {
      id: userData.id,
      wallet_address: userData.wallet_address,
      display_name: userData.display_name,
      email: userData.email,
      linked_wallets: userData.linked_wallet_addresses?.length || 0,
      linked_socials: userData.linked_social_accounts?.length || 0
    });
    
    if (userData.linked_wallet_addresses?.length > 0) {
      console.log('🔗 Linked wallets:', userData.linked_wallet_addresses);
    }
    
    if (userData.linked_social_accounts?.length > 0) {
      console.log('🔗 Linked socials:', userData.linked_social_accounts);
    } else {
      console.log('ℹ️ No linked social accounts found');
    }
    
    return userData;
    
  } catch (error) {
    console.log('❌ Error checking connections:', error);
    return null;
  }
}

// Force refresh connections
async function forceRefreshConnections() {
  console.log('\n🔄 FORCE REFRESHING CONNECTIONS...');
  
  // Trigger a page reload to refresh the UI
  if (window.location.pathname === '/edit-profile') {
    console.log('🔄 Refreshing edit profile page...');
    window.location.reload();
  } else {
    console.log('🔄 Navigating to edit profile...');
    window.location.href = '/edit-profile';
  }
}

// Main fix function
async function fixAllIssues() {
  console.log('🚀 FIXING ALL DISCORD & TWITTER ISSUES...\n');
  
  // Check if we're in a callback
  if (window.location.href.includes('/auth/callback')) {
    console.log('🔄 In OAuth callback - processing...');
    await fixDiscordCallback();
    return;
  }
  
  // Check current user state
  await checkUserConnections();
  
  // Test Discord linking capability
  await testDiscordLinking();
  
  console.log('\n✅ Diagnosis complete!');
  console.log('\n🛠️ Available fixes:');
  console.log('- fixTwitterOAuth() - Fix Twitter connection');
  console.log('- forceRefreshConnections() - Refresh UI');
  console.log('- checkUserConnections() - Check current state');
}

// Make functions available
window.fixDiscordCallback = fixDiscordCallback;
window.fixTwitterOAuth = fixTwitterOAuth;
window.testDiscordLinking = testDiscordLinking;
window.checkUserConnections = checkUserConnections;
window.forceRefreshConnections = forceRefreshConnections;
window.fixAllIssues = fixAllIssues;

console.log('\n🛠️ DISCORD & TWITTER FIXES:');
console.log('- fixAllIssues() - Complete diagnostic and fix');
console.log('- fixTwitterOAuth() - Fix Twitter OAuth issues');
console.log('- checkUserConnections() - Check your current connections');
console.log('- forceRefreshConnections() - Refresh the UI');
console.log('\n🚀 RUN: fixAllIssues()');

// Auto-run
fixAllIssues();
