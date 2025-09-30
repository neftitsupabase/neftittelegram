import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { processSocialLogin } from '@/api/socialAuth';

// Types for Telegram WebApp data
interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface WebAppInitData {
  query_id?: string;
  user?: TelegramUser;
  receiver?: TelegramUser;
  chat?: any;
  chat_type?: string;
  chat_instance?: string;
  start_param?: string;
  can_save?: boolean;
  auth_date: number;
  hash: string;
}

// Types
type TelegramAuthData = {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
  [key: string]: string | undefined;
};

type TelegramAuthResponse = {
  success: boolean;
  user?: any;
  error?: string;
};

// Verify Telegram WebApp init data
const verifyTelegramWebAppData = (initData: string): WebAppInitData | null => {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error('Telegram bot token is not configured. Please set TELEGRAM_BOT_TOKEN environment variable.');
    return null;
  }

  try {
    // Parse the init data
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    // Remove hash and sort remaining parameters
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Create secret key
    const secret = crypto
      .createHash('sha256')
      .update(BOT_TOKEN)
      .digest();

    // Verify the hash
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(dataCheckString)
      .digest('hex');

    if (hmac !== hash) {
      console.error('Invalid Telegram WebApp hash');
      return null;
    }

    // Parse user data
    const userData: WebAppInitData = {
      auth_date: Number(params.get('auth_date')) || 0,
      hash: hash
    };

    // Parse user object if exists
    const userStr = params.get('user');
    if (userStr) {
      try {
        userData.user = JSON.parse(userStr);
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    }

    // Add other fields
    if (params.has('query_id')) userData.query_id = params.get('query_id')!;
    if (params.has('receiver')) {
      try {
        userData.receiver = JSON.parse(params.get('receiver')!);
      } catch (e) {
        console.error('Failed to parse receiver data:', e);
      }
    }
    
    return userData;
  } catch (error) {
    console.error('Error verifying Telegram WebApp data:', error);
    return null;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { initData } = req.body;
  
  if (!initData) {
    return res.status(400).json({ error: 'Missing initData' });
  }

  try {

    // Verify the WebApp init data
    const webAppData = verifyTelegramWebAppData(initData);
    
    if (!webAppData || !webAppData.user) {
      console.error('Invalid Telegram WebApp data or missing user information');
      return res.status(403).json({ 
        error: 'Invalid authentication data. Please ensure your Telegram bot is properly configured with the correct domain.' 
      });
    }

    // Check if the auth data is not too old (24 hours)
    const authDate = webAppData.auth_date * 1000;
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (now - authDate > maxAge) {
      return res.status(403).json({ error: 'Authentication data is too old' });
    }

    // Format user data for processSocialLogin
    const userData = {
      id: webAppData.user.id.toString(),
      first_name: webAppData.user.first_name || '',
      last_name: webAppData.user.last_name || '',
      username: webAppData.user.username || `user_${webAppData.user.id}`,
      photo_url: webAppData.user.photo_url || '',
      auth_date: webAppData.auth_date.toString(),
      initData, // for reference/debugging
    };

    // Process the social login
    const result = await processSocialLogin('Telegram', userData);

    if (!result.success) {
      return res.status(401).json({ 
        error: result.error || 'Authentication failed',
      });
    }

    return res.status(200).json({ 
      success: true, 
      user: userData,
    });

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Telegram auth error:', error);
    }
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}
