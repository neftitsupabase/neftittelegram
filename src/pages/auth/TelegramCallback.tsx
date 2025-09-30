import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const TelegramCallback: React.FC = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleTelegramCallback = async () => {
      try {
        // Get the auth data from URL parameters
        const hash = searchParams.get('hash');
        const id = searchParams.get('id');
        const first_name = searchParams.get('first_name');
        const last_name = searchParams.get('last_name');
        const username = searchParams.get('username');
        const photo_url = searchParams.get('photo_url');
        const auth_date = searchParams.get('auth_date');

        if (!id) {
          throw new Error('Missing user ID in Telegram callback');
        }

        // Create user object
        const user = {
          id: parseInt(id),
          first_name: first_name || '',
          last_name: last_name || '',
          username: username || `user_${id}`,
          photo_url: photo_url || '',
          auth_date: auth_date ? parseInt(auth_date) : Math.floor(Date.now() / 1000),
          hash: hash || ''
        };

        // Send success message to parent window
        if (window.opener) {
          window.opener.postMessage({
            type: 'TELEGRAM_AUTH_SUCCESS',
            user: user
          }, window.location.origin);
        }

        // Close the popup window
        window.close();

      } catch (error) {
        console.error('Telegram callback error:', error);
        
        // Send error message to parent window
        if (window.opener) {
          window.opener.postMessage({
            type: 'TELEGRAM_AUTH_ERROR',
            error: error instanceof Error ? error.message : 'Authentication failed'
          }, window.location.origin);
        }

        // Close the popup window
        window.close();
      }
    };

    handleTelegramCallback();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#02020e] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5d43ef] mx-auto mb-4"></div>
        <h2 className="text-white text-xl font-semibold mb-2">Processing Telegram Authentication</h2>
        <p className="text-gray-400">Please wait while we complete your login...</p>
      </div>
    </div>
  );
};

export default TelegramCallback;
