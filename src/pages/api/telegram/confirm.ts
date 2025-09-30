import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

interface ConfirmRequest {
  userId: number;
  authData: string;
  messageId: number;
}

/**
 * Verify Telegram hash signature
 */
const verifyTelegramHash = (authData: string, botToken: string): any => {
  try {
    const urlParams = new URLSearchParams(authData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      throw new Error('Missing hash in auth data');
    }

    // Remove hash from params for verification
    urlParams.delete('hash');
    
    // Sort parameters alphabetically
    const sortedParams = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Create secret key from bot token
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    
    // Create hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(sortedParams)
      .digest('hex');

    if (calculatedHash !== hash) {
      throw new Error('Invalid hash signature');
    }

    // Parse user data
    const userData = {
      id: parseInt(urlParams.get('id') || '0'),
      first_name: urlParams.get('first_name') || '',
      last_name: urlParams.get('last_name') || '',
      username: urlParams.get('username') || '',
      photo_url: urlParams.get('photo_url') || '',
      auth_date: parseInt(urlParams.get('auth_date') || '0')
    };

    return userData;

  } catch (error) {
    console.error('Hash verification failed:', error);
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

  try {
    const { userId, authData, messageId }: ConfirmRequest = req.body;

    if (!userId || !authData || !messageId) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, authData, messageId' 
      });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('Telegram bot token is not configured');
      return res.status(500).json({ 
        error: 'Bot configuration error' 
      });
    }

    // Verify the Telegram hash signature
    const userData = verifyTelegramHash(authData, botToken);
    
    if (!userData || userData.id !== userId) {
      console.error('Invalid Telegram hash or user ID mismatch');
      return res.status(403).json({ 
        error: 'Invalid authentication data' 
      });
    }

    // Check if the auth data is not too old (5 minutes for approval flow)
    const authDate = userData.auth_date * 1000;
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    if (now - authDate > maxAge) {
      return res.status(403).json({ 
        error: 'Authentication data is too old' 
      });
    }

    // Import the social login processor
    const { processSocialLogin } = await import('@/api/socialAuth');

    // Format user data for processSocialLogin
    const formattedUserData = {
      id: userData.id.toString(),
      first_name: userData.first_name || '',
      last_name: userData.last_name || '',
      username: userData.username || `user_${userData.id}`,
      photo_url: userData.photo_url || '',
      auth_date: userData.auth_date.toString(),
      authData, // Store original auth data for reference
    };

    // Process the social login
    const result = await processSocialLogin('telegram', formattedUserData);

    if (!result.success) {
      console.error('Social login processing failed:', result.error);
      return res.status(500).json({ 
        error: result.error || 'Failed to process login' 
      });
    }

    console.log('✅ Telegram login confirmed successfully for user:', userData.id);

    // Return success with user data
    return res.status(200).json({
      success: true,
      message: 'Login confirmed successfully',
      user: result.user,
      session: {
        isAuthenticated: true,
        wallet_address: result.user.wallet_address,
        user_id: result.user.id
      }
    });

  } catch (error) {
    console.error('❌ Telegram confirmation error:', error);
    return res.status(500).json({ 
      error: 'Internal server error during confirmation' 
    });
  }
}
