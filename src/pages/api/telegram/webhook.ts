import { NextApiRequest, NextApiResponse } from 'next';
import TelegramBotService from '@/services/TelegramBotService';

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
    const update = req.body;

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      console.log('📱 Received callback query:', update.callback_query.data);
      
      const result = await TelegramBotService.handleCallbackQuery(update.callback_query);
      
      if (result.success) {
        console.log(`✅ Callback handled successfully: ${result.action} for user ${result.userId}`);
        return res.status(200).json({ 
          success: true, 
          action: result.action,
          userId: result.userId 
        });
      } else {
        console.error('❌ Failed to handle callback query');
        return res.status(500).json({ 
          error: 'Failed to handle callback query' 
        });
      }
    }

    // Handle other types of updates (messages, etc.)
    if (update.message) {
      console.log('📨 Received message:', update.message.text);
      
      // For now, just acknowledge the message
      return res.status(200).json({ 
        success: true, 
        message: 'Message received' 
      });
    }

    // Unknown update type
    console.log('❓ Unknown update type:', Object.keys(update));
    return res.status(200).json({ 
      success: true, 
      message: 'Update received but not processed' 
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
}
