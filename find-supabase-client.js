// Find Supabase Client Helper Script
// Copy and paste this into browser console to locate your supabase client

console.log('🔍 Searching for Supabase client...');

// Method 1: Check common global variables
const commonNames = ['supabase', 'supabaseClient', 'client', 'sb', '__SUPABASE_CLIENT__'];
const foundGlobals = [];

commonNames.forEach(name => {
  if (window[name]) {
    foundGlobals.push(name);
    console.log(`✅ Found client at: window.${name}`);
  }
});

// Method 2: Check React components for supabase props
let reactClient = null;
try {
  const reactFiber = document.querySelector('#root')?._reactInternalFiber ||
                   document.querySelector('#root')?._reactInternals ||
                   document.querySelector('[data-reactroot]')?._reactInternalFiber;
  
  if (reactFiber) {
    console.log('🔍 Searching React component tree...');
    // This is a simplified search - React DevTools would be better
  }
} catch (e) {
  console.log('⚠️ Could not search React tree');
}

// Method 3: Check for network requests
console.log('🔍 Checking for Supabase network requests...');
const supabaseRequests = [];

// Override fetch to catch supabase requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  if (typeof url === 'string' && url.includes('supabase')) {
    supabaseRequests.push(url);
    console.log('📡 Supabase request detected:', url);
  }
  return originalFetch.apply(this, args);
};

// Method 4: Check localStorage for supabase data
console.log('🔍 Checking localStorage for Supabase data...');
const supabaseKeys = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && (key.includes('supabase') || key.includes('sb-'))) {
    supabaseKeys.push(key);
    console.log(`🔑 Found Supabase key in localStorage: ${key}`);
  }
}

// Method 5: Manual client creation helper
function createManualSupabaseClient() {
  console.log('\n🛠️ Manual Supabase Client Creation');
  console.log('If you know your Supabase URL and key, run:');
  console.log('');
  console.log('// Import Supabase (if not already imported)');
  console.log('// const { createClient } = await import("@supabase/supabase-js");');
  console.log('');
  console.log('window.supabase = createClient(');
  console.log('  "YOUR_SUPABASE_URL",    // e.g., "https://abc123.supabase.co"');
  console.log('  "YOUR_SUPABASE_ANON_KEY"  // Your anon/public key');
  console.log(');');
}

// Method 6: Check current page URL for hints
const currentURL = window.location.href;
console.log(`📍 Current page: ${currentURL}`);

if (currentURL.includes('localhost') || currentURL.includes('127.0.0.1')) {
  console.log('💡 You\'re on localhost - make sure your dev server is running');
}

// Results summary
console.log('\n📊 SEARCH RESULTS:');

if (foundGlobals.length > 0) {
  console.log(`✅ Found ${foundGlobals.length} potential client(s):`, foundGlobals);
  console.log(`💡 Try setting: window.supabase = window.${foundGlobals[0]}`);
  
  // Auto-assign the first found client
  if (window[foundGlobals[0]]) {
    window.supabase = window[foundGlobals[0]];
    console.log(`🎯 Auto-assigned: window.supabase = window.${foundGlobals[0]}`);
    
    // Test the client
    if (window.supabase && typeof window.supabase.from === 'function') {
      console.log('🎉 Supabase client is ready! You can now run the debug tests.');
      return true;
    }
  }
} else {
  console.log('❌ No supabase client found in global scope');
}

if (supabaseKeys.length > 0) {
  console.log(`🔑 Found ${supabaseKeys.length} Supabase key(s) in localStorage`);
  console.log('💡 This suggests Supabase is being used on this page');
}

console.log('\n🚀 NEXT STEPS:');
console.log('1. Navigate to a page with authentication (like /login, /profile, /discover)');
console.log('2. Wait for the page to fully load');
console.log('3. Run this script again');
console.log('4. If still not found, check your app\'s source code for the supabase client initialization');

createManualSupabaseClient();

// Test if we now have a working client
if (window.supabase && typeof window.supabase.from === 'function') {
  console.log('\n✅ SUCCESS: Supabase client is available!');
  console.log('🧪 You can now run: runLinkingDebugTests()');
  return true;
} else {
  console.log('\n⚠️ Supabase client still not available');
  return false;
}
