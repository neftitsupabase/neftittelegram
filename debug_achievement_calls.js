// ============================================================================
// DEBUG ACHIEVEMENT SERVICE CALLS
// Check if achievement methods are actually being called during user actions
// ============================================================================

// Add this to browser console to monitor achievement calls
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Track achievement-related logs
const achievementLogs = [];

console.log = function(...args) {
  const message = args.join(' ');
  if (message.includes('achievement') || message.includes('Achievement') || message.includes('🏆')) {
    achievementLogs.push({
      type: 'log',
      timestamp: new Date().toISOString(),
      message: message
    });
  }
  originalConsoleLog.apply(console, args);
};

console.error = function(...args) {
  const message = args.join(' ');
  if (message.includes('achievement') || message.includes('Achievement') || message.includes('🏆')) {
    achievementLogs.push({
      type: 'error',
      timestamp: new Date().toISOString(),
      message: message
    });
  }
  originalConsoleError.apply(console, args);
};

// Function to check achievement logs
window.checkAchievementLogs = function() {
  console.log('🔍 Achievement Call Debug Report:');
  console.log(`Total achievement-related logs: ${achievementLogs.length}`);
  
  if (achievementLogs.length === 0) {
    console.log('❌ NO ACHIEVEMENT CALLS DETECTED');
    console.log('This means services are NOT calling achievement methods');
  } else {
    console.log('📋 Recent achievement logs:');
    achievementLogs.slice(-10).forEach((log, index) => {
      console.log(`${index + 1}. [${log.type.toUpperCase()}] ${log.timestamp}: ${log.message}`);
    });
  }
  
  return achievementLogs;
};

// Function to manually test a specific achievement
window.testAchievementUpdate = async function(achievementKey = 'first_quest') {
  console.log(`🧪 Testing manual achievement update for: ${achievementKey}`);
  
  try {
    // Get current user wallet (adjust based on your auth system)
    const walletAddress = localStorage.getItem('wallet_address') || 
                         sessionStorage.getItem('wallet_address') || 
                         '0x1234567890123456789012345678901234567890';
    
    console.log(`Using wallet: ${walletAddress}`);
    
    // Try to import and call achievement service directly
    const response = await fetch('/api/achievements/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallet_address: walletAddress,
        achievement_key: achievementKey,
        progress_increment: 1
      })
    });
    
    const result = await response.json();
    console.log('Manual update result:', result);
    
  } catch (error) {
    console.error('Manual test failed:', error);
    
    // Try direct database call
    try {
      console.log('Trying direct database call...');
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
      
      const { data, error } = await supabase.rpc('update_achievement_progress', {
        user_wallet: walletAddress,
        achievement_key_param: achievementKey,
        progress_increment: 1
      });
      
      console.log('Direct DB result:', { data, error });
      
    } catch (dbError) {
      console.error('Direct DB call failed:', dbError);
    }
  }
};

console.log('🔧 Achievement Debug Tools Loaded!');
console.log('📞 Call checkAchievementLogs() to see if achievement methods are being called');
console.log('🧪 Call testAchievementUpdate("first_quest") to manually test achievement updates');
console.log('👀 Now perform some actions (tasks, burns, stakes, referrals) and check logs...');
