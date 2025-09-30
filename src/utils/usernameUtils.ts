import { supabase } from '@/lib/supabase';

// Generate a random username with neftit_ prefix (valid per validator: letters, numbers, underscores)
export function generateRandomUsername(): string {
  const prefix = 'neftit_';
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';

  // Choose one of several patterns to add variety
  const pattern = Math.floor(Math.random() * 3); // 0,1,2

  const randomFrom = (chars: string, len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

  let suffix = '';
  if (pattern === 0) {
    // neftit_ + letters (3-5)
    suffix = randomFrom(letters, 3 + Math.floor(Math.random() * 3));
  } else if (pattern === 1) {
    // neftit_ + digits (3-4)
    suffix = randomFrom(digits, 3 + Math.floor(Math.random() * 2));
  } else {
    // neftit_ + letters(3-4) + '_' + digits(2-3)
    suffix = `${randomFrom(letters, 3 + Math.floor(Math.random() * 2))}_${randomFrom(digits, 2 + Math.floor(Math.random() * 2))}`;
  }

  return prefix + suffix;
}

// Check if username is unique in the database
export async function isUsernameUnique(username: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('display_name')
      .eq('display_name', username)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // No rows returned, username is unique
      return true;
    }
    
    if (error) {
      console.error('Error checking username uniqueness:', error);
      return false;
    }
    
    // If data exists, username is not unique
    return !data;
  } catch (error) {
    console.error('Error checking username uniqueness:', error);
    return false;
  }
}

// Generate a unique username that doesn't exist in the database
export async function generateUniqueUsername(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 50;
  
  while (attempts < maxAttempts) {
    const username = generateRandomUsername();
    const isUnique = await isUsernameUnique(username);
    
    if (isUnique) {
      return username;
    }
    
    attempts++;
  }
  
  // If we can't generate a unique username after 50 attempts, add a number
  const baseUsername = generateRandomUsername();
  return `${baseUsername}_${Date.now()}`;
}

// Validate username format
export function validateUsername(username: string): { isValid: boolean; error?: string } {
  if (!username || username.trim().length === 0) {
    return { isValid: false, error: 'Username cannot be empty' };
  }
  
  if (username.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters long' };
  }
  
  if (username.length > 20) {
    return { isValid: false, error: 'Username must be less than 20 characters' };
  }
  
  // Only allow letters, numbers, and underscores
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(username)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }
  
  return { isValid: true };
}
