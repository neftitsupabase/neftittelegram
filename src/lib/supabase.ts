import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get Supabase URL and key from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase environment variables. Please check your .env file.');
}

// Log supabase connection details for debugging (remove in production)
console.log('Supabase Connection Info:', {
  url: supabaseUrl,
  keyLength: supabaseKey ? supabaseKey.length : 0,
  hasCredentials: Boolean(supabaseUrl && supabaseKey)
});

// Create and export the Supabase client (singleton)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    // Increase timeout for slower network conditions
    fetch: (url, options) => {
      return fetch(url, {
        ...options,
        credentials: 'same-origin',
        // Longer timeout for potentially slow operations
        signal: options?.signal || (new AbortController().signal)
      }).catch(err => {
        console.error(`Fetch error for ${url}:`, err);
        throw err;
      });
    }
  }
});

// Create a client with wallet headers for RLS authentication
export const createClientWithWalletHeader = (walletAddress: string): SupabaseClient => {
  // Create a new client instance with wallet header for RLS
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    },
    global: {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-wallet-address': walletAddress  // CRITICAL: This header is required for RLS
      }
    }
  });
};

// Test connection on init
(async () => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.error('Supabase connection test failed:', error);
    } else {
      console.log('Supabase connection successful');
    }
  } catch (err) {
    console.error('Supabase connection error:', err);
  }
})();

// Storage interface for ThirdWeb Auth
export const createSupabaseClient = () => {
  return {
    // User-related data storage
    setItem: async (key: string, value: string) => {
      try {
        const user = key.split(':')[0];
        console.log(`Storing data for user: ${user}, key: ${key}`);

        const { data, error } = await supabase
          .from('user_data')
          .upsert({
            user_id: user,
            key: key,
            value: value
          });

        if (error) {
          console.error('Error storing in Supabase:', error);
          throw error;
        }

        console.log('Data stored successfully:', data);
      } catch (err) {
        console.error('Error in setItem:', err);
      }
    },

    // Retrieve user data
    getItem: async (key: string) => {
      try {
        console.log(`Retrieving data for key: ${key}`);

        const { data, error } = await supabase
          .from('user_data')
          .select('value')
          .eq('key', key)
          .single();

        if (error) {
          console.error('Error retrieving from Supabase:', error);
          return null;
        }

        console.log('Data retrieved:', data);
        return data?.value || null;
      } catch (err) {
        console.error('Error in getItem:', err);
        return null;
      }
    },

    // Remove user data
    removeItem: async (key: string) => {
      try {
        console.log(`Removing data for key: ${key}`);

        const { data, error } = await supabase
          .from('user_data')
          .delete()
          .eq('key', key);

        if (error) {
          console.error('Error removing from Supabase:', error);
          throw error;
        }

        console.log('Data removed successfully');
      } catch (err) {
        console.error('Error in removeItem:', err);
      }
    }
  };
};

export const storeWalletAuth = async (walletAddress: string) => {
  try {
    console.log(`Storing auth for wallet: ${walletAddress}`);

    // First check if the user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .filter('wallet_address', 'eq', walletAddress)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('Error checking user existence:', checkError);
      return false;
    }

    const timestamp = new Date().toISOString();
    let result;

    if (existingUser) {
      console.log('Updating existing user');
      // Update existing user
      result = await supabase
        .from('users')
        .update({
          last_login: timestamp,
          updated_at: timestamp
        })
        .filter('wallet_address', 'eq', walletAddress);
    } else {
      console.log('Creating new user');
      // Insert new user
      result = await supabase
        .from('users')
        .insert({
          wallet_address: walletAddress,
          display_name: `User_${walletAddress.substring(0, 6)}`,
          created_at: timestamp,
          updated_at: timestamp,
          last_login: timestamp
        });
    }

    if (result.error) {
      console.error('Error storing wallet auth:', result.error);
      return false;
    }

    console.log('Wallet auth stored successfully');
    return true;
  } catch (err) {
    console.error('Error in storeWalletAuth:', err);
    return false;
  }
};

export const getWalletProfile = async (walletAddress: string) => {
  try {
    console.log(`Fetching profile for wallet: ${walletAddress}`);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (error) {
      console.error('Error fetching wallet profile:', error);
      return null;
    }

    console.log('Wallet profile retrieved:', data);
    return data;
  } catch (err) {
    console.error('Error in getWalletProfile:', err);
    return null;
  }
};

// Add this helper function to inspect the database schema
export async function inspectDatabaseSchema() {
  try {
    if (!supabase) {
      console.error('Cannot inspect schema: Supabase client not initialized');
      return;
    }

    console.log('Inspecting database schema for users table...');

    // First try to get table info by selecting a row
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error fetching table info:', error);
    } else if (users && users.length > 0) {
      console.log('Users table columns:', Object.keys(users[0]));
      return Object.keys(users[0]);
    } else {
      console.log('Users table is empty, trying to get schema information...');

      // If table is empty, try to query the info schema
      try {
        const { data: tableInfo, error: schemaError } = await supabase
          .rpc('get_table_columns', { table_name: 'users' });

        if (schemaError) {
          console.error('Error fetching schema info:', schemaError);
        } else {
          console.log('Users table schema:', tableInfo);
          return tableInfo;
        }
      } catch (rpcError) {
        console.error('RPC error:', rpcError);
      }
    }
  } catch (e) {
    console.error('Schema inspection error:', e);
  }
}

// Store Telegram user data in Supabase
export const storeTelegramUser = async (userData: {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
  wallet_address?: string;
  email?: string;
}) => {
  console.log('===== STORING TELEGRAM USER IN SUPABASE =====');
  console.log('User data received:', JSON.stringify(userData, null, 2));

  // Verify Supabase client is initialized
  if (!supabase) {
    const error = new Error('Supabase client is not initialized');
    console.error(error);
    return { data: null, error };
  }

  try {
    // Prepare user data with common column names
    const userDataToStore: Record<string, any> = {
      // Common user fields
      id: userData.id, // This might be the primary key in your table
      email: userData.email || `${userData.username || userData.id}@telegram.user`,
      name: [userData.first_name, userData.last_name].filter(Boolean).join(' ').trim() || `User ${userData.id}`,
      image: userData.photo_url || null,

      // Additional fields that might exist
      first_name: userData.first_name || '',
      last_name: userData.last_name || '',
      username: userData.username || `user_${userData.id}`,
      avatar_url: userData.photo_url || null,
      photo_url: userData.photo_url || null,
      telegram_id: userData.id,
      telegram_username: userData.username || '',
      auth_date: new Date(userData.auth_date * 1000).toISOString(),
      wallet_address: userData.wallet_address || null,
      last_login: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    console.log('Prepared user data for storage:', JSON.stringify(userDataToStore, null, 2));

    // First, try to find if user exists by email or id
    console.log('Checking for existing user...');
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, email')
      .or(`id.eq.${userData.id},email.eq.${userData.email || userData.username + '@telegram.user'}`)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking for existing user:', fetchError);
      throw fetchError;
    }

    let data, error;

    if (existingUser) {
      // Update existing user - try to update by ID first, then by email
      console.log('Updating existing user...');
      const updateResult = await supabase
        .from('users')
        .update(userDataToStore)
        .eq('id', existingUser.id) // Try updating by internal ID
        .select()
        .single();

      if (updateResult.error) {
        console.log('Update by ID failed, trying by email...');
        const emailToUse = userData.email || `${userData.username || userData.id}@telegram.user`;
        const updateByEmail = await supabase
          .from('users')
          .update(userDataToStore)
          .eq('email', emailToUse)
          .select()
          .single();
        data = updateByEmail.data;
        error = updateByEmail.error;
      } else {
        data = updateResult.data;
        error = updateResult.error;
      }
    } else {
      // Insert new user - only include fields that exist in the table
      console.log('Inserting new user...');

      // First, try to get the table structure to only include existing columns
      const { data: tableInfo, error: tableError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'users');

      if (!tableError && tableInfo) {
        const existingColumns = tableInfo.map(col => col.column_name);
        const filteredData = Object.keys(userDataToStore)
          .filter(key => existingColumns.includes(key))
          .reduce((obj: Record<string, any>, key) => {
            obj[key] = userDataToStore[key];
            return obj;
          }, {});

        console.log('Filtered user data for insert:', JSON.stringify(filteredData, null, 2));

        const insertResult = await supabase
          .from('users')
          .insert([filteredData])
          .select()
          .single();
        data = insertResult.data;
        error = insertResult.error;
      } else {
        // If we can't get table info, try with the original data
        console.warn('Could not get table structure, trying with all fields...');
        const insertResult = await supabase
          .from('users')
          .insert([userDataToStore])
          .select()
          .single();
        data = insertResult.data;
        error = insertResult.error;
      }
    }

    if (error) {
      console.error('Supabase upsert error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    console.log('Successfully stored user data in Supabase:', JSON.stringify(data, null, 2));
    return { data, error: null };

  } catch (error) {
    console.error('Error in storeTelegramUser:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      details: error.details,
      hint: error.hint
    });

    // If there's a specific database error, try to get more details
    if (error.code) {
      console.error('Database error details:', {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message
      });
    }

    return { data: null, error };
  }
};

// Check if Supabase is properly initialized
if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase is not properly configured. Please check your .env file.');
  // You might want to throw an error or handle this case appropriately
  throw new Error('Supabase configuration is missing. Please check your environment variables.');
}

// Initialize Supabase and inspect schema on load
const supabaseClient = createSupabaseClient();

// Test the Supabase connection
(async () => {
  try {
    const { data, error } = await supabase.from('users').select('*').limit(1);
    if (error) {
      console.error('Supabase connection test failed:', error);
    } else {
      console.log('Supabase connection successful');
    }
  } catch (error) {
    console.error('Error testing Supabase connection:', error);
  }
})();

// Inspect database schema
inspectDatabaseSchema().catch(console.error);

export default supabase; 