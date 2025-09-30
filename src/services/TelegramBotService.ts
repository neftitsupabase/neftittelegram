/**
 * Telegram Bot Service for sending approval messages
 * Implements Galxe-style approval flow with Confirm/Decline buttons
 */

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
}

export interface ApprovalMessage {
  messageId: number;
  chatId: number;
  userId: number;
  authData: string;
  timestamp: number;
}

export class TelegramBotService {
  private static readonly BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  private static readonly BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;
  private static readonly API_BASE_URL = 'https://api.telegram.org/bot';
  private static readonly WEBHOOK_BASE_URL = import.meta.env.VITE_APP_URL || 'https://neftittelegram-git-master-neftits-projects.vercel.app';

  /**
   * Send approval message to user with Confirm/Decline buttons
   */
  static async sendApprovalMessage(user: TelegramUser, authData: string): Promise<ApprovalMessage | null> {
    try {
      if (!this.BOT_TOKEN) {
        throw new Error('Telegram bot token not configured');
      }

      const message = `🔐 **NEFTIT Login Request**\n\n` +
        `Hello ${user.first_name}!\n\n` +
        `Someone is trying to log into your NEFTIT account using Telegram.\n\n` +
        `**Details:**\n` +
        `• Name: ${user.first_name} ${user.last_name || ''}\n` +
        `• Username: @${user.username || 'N/A'}\n` +
        `• Time: ${new Date().toLocaleString()}\n\n` +
        `If this was you, please confirm the login. If not, please decline.`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: '✅ Confirm Login',
              callback_data: `confirm_login_${user.id}_${Date.now()}`
            },
            {
              text: '❌ Decline',
              callback_data: `decline_login_${user.id}_${Date.now()}`
            }
          ]
        ]
      };

      const response = await fetch(`${this.API_BASE_URL}${this.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: user.id,
          text: message,
          parse_mode: 'Markdown',
          reply_markup: inlineKeyboard
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Telegram API error: ${errorData.description || response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(`Failed to send message: ${result.description}`);
      }

      // Store the approval message data for verification
      const approvalMessage: ApprovalMessage = {
        messageId: result.result.message_id,
        chatId: result.result.chat.id,
        userId: user.id,
        authData: authData,
        timestamp: Date.now()
      };

      // Store in localStorage for now (in production, use a proper database)
      this.storeApprovalMessage(approvalMessage);

      console.log('✅ Approval message sent successfully:', approvalMessage);
      return approvalMessage;

    } catch (error) {
      console.error('❌ Failed to send approval message:', error);
      throw error;
    }
  }

  /**
   * Handle callback query from inline keyboard buttons
   */
  static async handleCallbackQuery(callbackQuery: any): Promise<{ success: boolean; action: string; userId: number }> {
    try {
      const { data, from, message } = callbackQuery;
      const userId = from.id;

      if (data.startsWith('confirm_login_')) {
        // User confirmed login
        const approvalMessage = this.getApprovalMessage(userId);
        
        if (!approvalMessage) {
          throw new Error('Approval message not found or expired');
        }

        // Verify the auth data and create session
        const result = await this.confirmLogin(approvalMessage);
        
        // Update localStorage to notify the frontend
        this.updateApprovalStatus(userId, { confirmed: true });
        
        // Answer the callback query
        await this.answerCallbackQuery(callbackQuery.id, '✅ Login confirmed! You can now close this message.');
        
        return { success: true, action: 'confirm', userId };
        
      } else if (data.startsWith('decline_login_')) {
        // User declined login
        await this.answerCallbackQuery(callbackQuery.id, '❌ Login declined. If this was not you, your account is secure.');
        
        // Update localStorage to notify the frontend
        this.updateApprovalStatus(userId, { declined: true });
        
        // Clean up the approval message
        this.removeApprovalMessage(userId);
        
        return { success: true, action: 'decline', userId };
      }

      throw new Error('Unknown callback data');

    } catch (error) {
      console.error('❌ Failed to handle callback query:', error);
      await this.answerCallbackQuery(callbackQuery.id, '❌ An error occurred. Please try again.');
      throw error;
    }
  }

  /**
   * Answer a callback query
   */
  private static async answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
    try {
      await fetch(`${this.API_BASE_URL}${this.BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text,
          show_alert: false
        })
      });
    } catch (error) {
      console.error('Failed to answer callback query:', error);
    }
  }

  /**
   * Confirm login and create session
   */
  private static async confirmLogin(approvalMessage: ApprovalMessage): Promise<any> {
    try {
      // Call our backend API to verify and create session
      const response = await fetch(`${this.WEBHOOK_BASE_URL}/api/telegram/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: approvalMessage.userId,
          authData: approvalMessage.authData,
          messageId: approvalMessage.messageId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to confirm login with backend');
      }

      const result = await response.json();
      
      // Clean up the approval message
      this.removeApprovalMessage(approvalMessage.userId);
      
      return result;

    } catch (error) {
      console.error('❌ Failed to confirm login:', error);
      throw error;
    }
  }

  /**
   * Store approval message data (temporary storage)
   */
  private static storeApprovalMessage(approvalMessage: ApprovalMessage): void {
    try {
      const key = `telegram_approval_${approvalMessage.userId}`;
      localStorage.setItem(key, JSON.stringify(approvalMessage));
      
      // Set expiration (5 minutes)
      setTimeout(() => {
        this.removeApprovalMessage(approvalMessage.userId);
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error('Failed to store approval message:', error);
    }
  }

  /**
   * Get approval message data
   */
  private static getApprovalMessage(userId: number): ApprovalMessage | null {
    try {
      const key = `telegram_approval_${userId}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get approval message:', error);
      return null;
    }
  }

  /**
   * Remove approval message data
   */
  private static removeApprovalMessage(userId: number): void {
    try {
      const key = `telegram_approval_${userId}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove approval message:', error);
    }
  }

  /**
   * Update approval status in localStorage
   */
  private static updateApprovalStatus(userId: number, status: { confirmed?: boolean; declined?: boolean }): void {
    try {
      const key = `telegram_approval_${userId}`;
      const existingData = localStorage.getItem(key);
      
      if (existingData) {
        const data = JSON.parse(existingData);
        const updatedData = { ...data, ...status };
        localStorage.setItem(key, JSON.stringify(updatedData));
      }
    } catch (error) {
      console.error('Failed to update approval status:', error);
    }
  }

  /**
   * Set webhook for receiving callback queries
   */
  static async setWebhook(): Promise<boolean> {
    try {
      if (!this.BOT_TOKEN) {
        throw new Error('Telegram bot token not configured');
      }

      const webhookUrl = `${this.WEBHOOK_BASE_URL}/api/telegram/webhook`;
      
      const response = await fetch(`${this.API_BASE_URL}${this.BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['callback_query']
        })
      });

      const result = await response.json();
      
      if (result.ok) {
        console.log('✅ Webhook set successfully:', webhookUrl);
        return true;
      } else {
        console.error('❌ Failed to set webhook:', result.description);
        return false;
      }

    } catch (error) {
      console.error('❌ Failed to set webhook:', error);
      return false;
    }
  }

  /**
   * Get bot information
   */
  static async getBotInfo(): Promise<any> {
    try {
      if (!this.BOT_TOKEN) {
        throw new Error('Telegram bot token not configured');
      }

      const response = await fetch(`${this.API_BASE_URL}${this.BOT_TOKEN}/getMe`);
      const result = await response.json();
      
      if (result.ok) {
        return result.result;
      } else {
        throw new Error(`Failed to get bot info: ${result.description}`);
      }

    } catch (error) {
      console.error('❌ Failed to get bot info:', error);
      throw error;
    }
  }
}

export default TelegramBotService;
