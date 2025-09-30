// SUPABASE CLIENT FINDER AND FIXER
// This will help us find and fix the Supabase client loading issue

console.log('🔍 SEARCHING FOR SUPABASE CLIENT...');

// Method 1: Check if Supabase is in any global variables
function checkGlobalVariables() {
  console.log('\n📍 Checking global variables...');
  
  const possibleNames = [
    'supabase', 'supabaseClient', 'client', 'sb', '__SUPABASE_CLIENT__',
    'createClient', 'SupabaseClient', 'supabaseInstance'
  ];
  
  const found = [];
  for (const name of possibleNames) {
    if (window[name]) {
      found.push({ name, type: typeof window[name], value: window[name] });
    }
  }
  
  if (found.length > 0) {
    console.log('✅ Found potential Supabase clients:', found);
    return found;
  } else {
    console.log('❌ No Supabase clients found in global scope');
    return [];
  }
}

// Method 2: Check if we can import Supabase
async function checkImports() {
  console.log('\n📦 Checking imports...');
  
  try {
    // Try importing the supabase client
    const supabaseModule = await import('@/lib/supabase');
    console.log('✅ Supabase module imported successfully:', supabaseModule);
    
    if (supabaseModule.supabase) {
      window.supabase = supabaseModule.supabase;
      console.log('🎯 Assigned supabase client to window.supabase');
      return supabaseModule.supabase;
    }
    
    if (supabaseModule.createSupabaseClient) {
      console.log('✅ Found createSupabaseClient function');
      return supabaseModule.createSupabaseClient;
    }
    
    return supabaseModule;
  } catch (error) {
    console.log('❌ Failed to import Supabase:', error);
    return null;
  }
}

// Method 3: Try to create client manually
async function createManualClient() {
  console.log('\n🛠️ Attempting to create Supabase client manually...');
  
  try {
    // Try to import Supabase library
    const { createClient } = await import('@supabase/supabase-js');
    console.log('✅ Supabase library imported');
    
    // Check if we have environment variables
    const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 
                       process.env?.VITE_SUPABASE_URL ||
                       process.env?.NEXT_PUBLIC_SUPABASE_URL;
                       
    const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 
                       process.env?.VITE_SUPABASE_ANON_KEY ||
                       process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      url: supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'Not found'
    });
    
    if (supabaseUrl && supabaseKey) {
      const client = createClient(supabaseUrl, supabaseKey);
      window.supabase = client;
      console.log('🎉 Supabase client created and assigned to window.supabase!');
      return client;
    } else {
      console.log('❌ Missing Supabase URL or API key in environment variables');
      return null;
    }
  } catch (error) {
    console.log('❌ Failed to create manual client:', error);
    return null;
  }
}

// Method 4: Check React context/providers
function checkReactContext() {
  console.log('\n⚛️ Checking React context...');
  
  try {
    // Look for React fiber
    const rootElement = document.querySelector('#root') || document.querySelector('[data-reactroot]');
    if (!rootElement) {
      console.log('❌ No React root element found');
      return null;
    }
    
    // Try to find React internals
    const fiberKey = Object.keys(rootElement).find(key => key.startsWith('__reactInternalInstance') || key.startsWith('_reactInternals'));
    
    if (fiberKey) {
      console.log('✅ React fiber found, but client extraction is complex');
      console.log('💡 The Supabase client should be in a React context provider');
    } else {
      console.log('❌ React fiber not accessible');
    }
    
    return null;
  } catch (error) {
    console.log('❌ React context check failed:', error);
    return null;
  }
}

// Method 5: Check for network requests
function checkNetworkRequests() {
  console.log('\n📡 Setting up network monitoring...');
  
  // Monitor fetch requests
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string' && url.includes('supabase')) {
      console.log('🔍 Supabase request detected:', url);
    }
    return originalFetch.apply(this, args);
  };
  
  console.log('✅ Network monitoring active - will log Supabase requests');
}

// Main diagnostic function
async function findSupabaseClient() {
  console.log('🚀 STARTING SUPABASE CLIENT SEARCH...\n');
  
  // Check all methods
  const globalVars = checkGlobalVariables();
  const importedModule = await checkImports();
  const manualClient = await createManualClient();
  checkReactContext();
  checkNetworkRequests();
  
  // Summary
  console.log('\n📊 SEARCH RESULTS:');
  console.log('Global variables:', globalVars.length > 0 ? '✅ Found' : '❌ None');
  console.log('Import success:', importedModule ? '✅ Success' : '❌ Failed');
  console.log('Manual creation:', manualClient ? '✅ Success' : '❌ Failed');
  
  // Final test
  if (typeof window.supabase !== 'undefined') {
    console.log('\n🎉 SUCCESS! Supabase client is now available at window.supabase');
    
    // Quick test
    try {
      const { data, error } = await window.supabase.from('users').select('count').limit(1);
      if (error) {
        console.log('⚠️ Client available but database connection failed:', error);
      } else {
        console.log('✅ Database connection test successful!');
        console.log('🎯 You can now run authentication tests!');
      }
    } catch (testError) {
      console.log('⚠️ Client test failed:', testError);
    }
  } else {
    console.log('\n❌ FAILED: Could not establish Supabase client');
    console.log('\n💡 SOLUTIONS:');
    console.log('1. Check your Supabase configuration in your app');
    console.log('2. Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
    console.log('3. Make sure Supabase client is properly initialized in your app');
    console.log('4. Check browser console for import/connection errors');
  }
}

// Quick fix function
async function quickFix() {
  console.log('🔧 ATTEMPTING QUICK FIX...');
  
  try {
    // Try the most common solution
    const module = await import('@/lib/supabase');
    if (module.supabase) {
      window.supabase = module.supabase;
      console.log('✅ Quick fix successful! Supabase client assigned.');
      return true;
    }
  } catch (error) {
    console.log('❌ Quick fix failed:', error);
  }
  
  return false;
}

// Make functions available
window.findSupabaseClient = findSupabaseClient;
window.quickFix = quickFix;
window.checkGlobalVariables = checkGlobalVariables;
window.checkImports = checkImports;
window.createManualClient = createManualClient;

console.log('\n🛠️ SUPABASE CLIENT FIXER COMMANDS:');
console.log('- quickFix() - Try quick fix first');
console.log('- findSupabaseClient() - Full diagnostic');
console.log('\n🚀 START WITH: quickFix()');
