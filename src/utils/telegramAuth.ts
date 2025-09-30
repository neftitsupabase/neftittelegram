// Standalone Telegram authentication utility for edit profile page
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import TelegramBotService from "@/services/TelegramBotService";

const TELEGRAM_BOT = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "neftit_bot";

/**
 * Wait for user confirmation via polling
 */
const waitForConfirmation = (userId: number): Promise<{ success: boolean; action?: string }> => {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    const pollInterval = 1000; // 1 second

    const poll = () => {
      attempts++;
      
      // Check if confirmation was received
      const key = `telegram_approval_${userId}`;
      const approvalData = localStorage.getItem(key);
      
      if (approvalData) {
        try {
          const data = JSON.parse(approvalData);
          if (data.confirmed) {
            resolve({ success: true, action: 'confirm' });
            return;
          } else if (data.declined) {
            resolve({ success: false, action: 'decline' });
            return;
          }
        } catch (error) {
          console.error('Error parsing approval data:', error);
        }
      }

      if (attempts >= maxAttempts) {
        resolve({ success: false, action: 'timeout' });
        return;
      }

      setTimeout(poll, pollInterval);
    };

    // Start polling
    poll();
  });
};

export const initiateTelegramAuth = async (): Promise<any> => {
  return new Promise((resolve, reject) => {
    // Check if bot username is configured
    if (!TELEGRAM_BOT || TELEGRAM_BOT === "your_bot_username") {
      const error = "Telegram bot is not properly configured. Please check your environment variables.";
      toast.error(error);
      reject(new Error(error));
      return;
    }

    try {
      // Create a temporary container for the Telegram widget
      const widgetContainer = document.createElement('div');
      widgetContainer.style.position = 'fixed';
      widgetContainer.style.top = '50%';
      widgetContainer.style.left = '50%';
      widgetContainer.style.transform = 'translate(-50%, -50%)';
      widgetContainer.style.zIndex = '9999';
      widgetContainer.style.backgroundColor = 'white';
      widgetContainer.style.padding = '20px';
      widgetContainer.style.borderRadius = '8px';
      widgetContainer.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
      widgetContainer.id = 'telegram-widget-container';

      // Add close button
      const closeButton = document.createElement('button');
      closeButton.innerHTML = '×';
      closeButton.style.position = 'absolute';
      closeButton.style.top = '10px';
      closeButton.style.right = '15px';
      closeButton.style.background = 'none';
      closeButton.style.border = 'none';
      closeButton.style.fontSize = '24px';
      closeButton.style.cursor = 'pointer';
      closeButton.style.color = '#666';
      closeButton.onclick = () => {
        document.body.removeChild(widgetContainer);
        reject(new Error('User cancelled authentication'));
      };

      widgetContainer.appendChild(closeButton);

      // Add loading message
      const loadingDiv = document.createElement('div');
      loadingDiv.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <h3 style="margin: 0 0 10px 0; color: #333;">Connect with Telegram</h3>
          <p style="margin: 0; color: #666;">Loading Telegram authentication...</p>
        </div>
      `;
      widgetContainer.appendChild(loadingDiv);

      document.body.appendChild(widgetContainer);

      // Create the Telegram Login Widget script
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', TELEGRAM_BOT);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-onauth', 'onTelegramAuth');
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-userpic', 'false');
      script.async = true;

      // Define the global handler for Telegram login
      (window as any).onTelegramAuth = async function (user: any) {
        console.log('Telegram user data received:', user);
        
        try {
          // Clean up the widget
          document.body.removeChild(widgetContainer);
          delete (window as any).onTelegramAuth;
          
          // Show loading message
          const loadingDiv = document.createElement('div');
          loadingDiv.innerHTML = `
            <div style="text-align: center; padding: 20px;">
              <h3 style="margin: 0 0 10px 0; color: #333;">Sending Approval Request</h3>
              <p style="margin: 0; color: #666;">Please check your Telegram for a confirmation message...</p>
            </div>
          `;
          widgetContainer.appendChild(loadingDiv);
          
          // Send approval message via bot
          const authData = (window as any).Telegram?.WebApp?.initData || '';
          const approvalMessage = await TelegramBotService.sendApprovalMessage(user, authData);
          
          if (approvalMessage) {
            // Wait for user confirmation (polling approach)
            const confirmation = await waitForConfirmation(user.id);
            
            if (confirmation.success) {
              resolve(user);
            } else {
              reject(new Error('Login was declined or timed out'));
            }
          } else {
            reject(new Error('Failed to send approval message'));
          }
          
        } catch (error) {
          console.error('Error in Telegram auth handler:', error);
          reject(error);
        }
      };

      // Add error handling
      script.onerror = () => {
        document.body.removeChild(widgetContainer);
        delete (window as any).onTelegramAuth;
        reject(new Error('Failed to load Telegram widget'));
      };

      // Replace loading message with widget
      widgetContainer.replaceChild(script, loadingDiv);

    } catch (error) {
      console.error('Error setting up Telegram authentication:', error);
      reject(error);
    }
  });
};

export const processTelegramAuthSuccess = async (user: any, mode: 'primary' | 'additional' = 'additional') => {
  try {
    console.log('🚀 Processing Telegram authentication success:', { user, mode });

    if (mode === 'additional') {
      // For additional connections (edit profile), use the linking system
      console.log('🔗 ADDITIONAL MODE: Linking Telegram account');
      
      // Use the imported supabase client
      
      // Get current user's primary wallet address
      const primaryWalletAddress = localStorage.getItem('primary_wallet_address') || 
                                   localStorage.getItem('wallet_address') ||
                                   localStorage.getItem('address');
      
      if (!primaryWalletAddress) {
        throw new Error('No primary wallet address found. Please log in first.');
      }

      // Link the Telegram account to the existing user
      const { data: linkResult, error: linkError } = await supabase.rpc('link_additional_provider', {
        primary_wallet_address: primaryWalletAddress,
        provider: 'telegram',
        provider_user_id: user.id.toString(),
        provider_username: user.username || `telegram_user_${user.id}`,
        provider_display_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || `User ${user.id}`,
        provider_avatar_url: user.photo_url || '',
        provider_metadata: {
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          username: user.username || '',
          auth_date: user.auth_date || Math.floor(Date.now() / 1000)
        }
      });

      if (linkError) {
        console.error('❌ Failed to link Telegram account:', linkError);
        throw new Error('Failed to link Telegram account. It may already be connected to another user.');
      } else if (linkResult) {
        console.log('✅ Successfully linked Telegram account');
        toast.success('Telegram account linked successfully!');
        
        // Clean up temporary storage
        localStorage.removeItem('connection_mode');
        localStorage.removeItem('primary_wallet_address');
        localStorage.removeItem('oauth_provider');
        
        return { success: true, message: 'Telegram account linked successfully!' };
      } else {
        console.warn('⚠️ Link operation returned false - account may already be linked');
        toast.warning('Telegram account is already connected.');
        return { success: false, message: 'Telegram account is already connected.' };
      }
    } else {
      // For primary connections, use the unified social login system
      console.log('🚀 PRIMARY MODE: Processing Telegram social login');
      
      const { processSocialLogin } = await import('@/api/socialAuth');
      
      // Format user data for the unified system
      const userData = {
        id: user.id.toString(),
        username: user.username || `telegram_user_${user.id}`,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        photo_url: user.photo_url || '',
        auth_date: user.auth_date || Math.floor(Date.now() / 1000)
      };

      const result = await processSocialLogin('telegram', userData);

      if (!result.success) {
        throw new Error(result.error || 'Telegram authentication failed');
      }

      // Store session and redirect
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('user', JSON.stringify(result.user));
      localStorage.setItem('wallet_address', result.user.wallet_address);
      localStorage.setItem('address', result.user.wallet_address);
      localStorage.setItem('primary_wallet_address', result.user.wallet_address);
      localStorage.setItem('isNewUserSession', 'true');

      toast.success('Welcome! Telegram account connected successfully.');
      
      return { success: true, user: result.user, redirect: '/discover' };
    }

  } catch (error) {
    console.error('❌ Telegram authentication processing failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Telegram authentication failed';
    toast.error(errorMessage);
    throw error;
  }
};
