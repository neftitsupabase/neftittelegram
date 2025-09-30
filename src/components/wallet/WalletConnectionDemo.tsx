import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConnectProvider } from '@/hooks/useConnectProvider';
import { toast } from 'sonner';

export const WalletConnectionDemo: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<Record<string, string>>({});
  
  const { connectWalletProvider, connecting, error } = useConnectProvider({
    mode: 'additional',
    onSuccess: (provider, data) => {
      console.log('✅ Wallet connected successfully:', { provider, data });
      setConnectionStatus(prev => ({ ...prev, [provider]: 'connected' }));
      toast.success(`${provider} wallet connected successfully!`);
    },
    onError: (error) => {
      console.error('❌ Wallet connection failed:', error);
      toast.error(`Connection failed: ${error}`);
    }
  });

  const handleConnectWallet = async (walletType: string) => {
    try {
      setConnectionStatus(prev => ({ ...prev, [walletType]: 'connecting' }));
      await connectWalletProvider(walletType);
    } catch (error) {
      console.error(`Failed to connect ${walletType}:`, error);
      setConnectionStatus(prev => ({ ...prev, [walletType]: 'failed' }));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-500';
      case 'connecting': return 'text-blue-500';
      case 'failed': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'failed': return 'Failed';
      default: return 'Not Connected';
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Wallet Connection Demo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Button
            onClick={() => handleConnectWallet('metamask')}
            disabled={connecting.metamask}
            className="w-full"
          >
            {connecting.metamask ? 'Connecting...' : 'Connect MetaMask'}
          </Button>
          
          <Button
            onClick={() => handleConnectWallet('phantom')}
            disabled={connecting.phantom}
            className="w-full"
          >
            {connecting.phantom ? 'Connecting...' : 'Connect Phantom'}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span>MetaMask:</span>
            <span className={getStatusColor(connectionStatus.metamask)}>
              {getStatusText(connectionStatus.metamask)}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>Phantom:</span>
            <span className={getStatusColor(connectionStatus.phantom)}>
              {getStatusText(connectionStatus.phantom)}
            </span>
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm">
            Error: {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WalletConnectionDemo;

