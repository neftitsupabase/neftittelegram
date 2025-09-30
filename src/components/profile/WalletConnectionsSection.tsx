import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface WalletStatus {
  name: string;
  icon: string;
  connected: boolean;
}

interface WalletConnectionsSectionProps {
  wallets: WalletStatus[];
  onConnect: (wallet: string) => void;
  onDisconnect: (wallet: string) => void;
}

export const WalletConnectionsSection: React.FC<WalletConnectionsSectionProps> = ({ wallets, onConnect, onDisconnect }) => {
  // Local state to ensure UI updates
  const [localWallets, setLocalWallets] = useState<WalletStatus[]>(wallets);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [disconnectingWallet, setDisconnectingWallet] = useState<string | null>(null);
  
  // Update local state when prop changes
  useEffect(() => {
    setLocalWallets(wallets);
  }, [wallets]);
  
  // Listen for wallet disconnect events
  useEffect(() => {
    const handleWalletDisconnect = (event: Event) => {
      const customEvent = event as CustomEvent;
      // For targeted disconnects with specific wallet info
      if (customEvent.detail?.walletName) {
        setLocalWallets(prev => prev.map(w => 
          w.name === customEvent.detail.walletName ? { ...w, connected: false } : w
        ));
        setDisconnectingWallet(null);
      } else {
        // Generic case - disconnect all wallets
        setLocalWallets(prev => prev.map(w => ({ ...w, connected: false })));
        setDisconnectingWallet(null);
        setConnectingWallet(null);
      }
    };
    
    // Listen for wallet connection success
    const handleWalletConnect = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.walletName) {
        setLocalWallets(prev => prev.map(w => 
          w.name === customEvent.detail.walletName ? { ...w, connected: true } : w
        ));
      }
      setConnectingWallet(null);
    };
    
    // Listen for both custom events
    window.addEventListener('wallet-disconnected', handleWalletDisconnect);
    window.addEventListener('walletDisconnect', handleWalletDisconnect);
    window.addEventListener('wallet-connected', handleWalletConnect);
    
    // Clean up
    return () => {
      window.removeEventListener('wallet-disconnected', handleWalletDisconnect);
      window.removeEventListener('walletDisconnect', handleWalletDisconnect);
      window.addEventListener('wallet-connected', handleWalletConnect);
    };
  }, []);
  
  // Handle connect button click
  const handleConnectClick = async (walletName: string) => {
    try {
      // Show loading state
      setConnectingWallet(walletName);
      
      // Call the connect function from props
      await onConnect(walletName);
      
      // Connection should be handled by event listeners,
      // but we'll update UI optimistically
      setTimeout(() => {
        if (connectingWallet === walletName) {
          setConnectingWallet(null);
          // If after 5 seconds we're still connecting, assume it failed
          toast.error(`Connection to ${walletName} timed out. Please try again.`);
        }
      }, 5000);
    } catch (error) {
      console.error(`Error connecting to ${walletName}:`, error);
      setConnectingWallet(null);
      toast.error(`Failed to connect to ${walletName}. Please try again.`);
    }
  };
  
  // Handle disconnect button click
  const handleDisconnectClick = async (walletName: string) => {
    try {
      // Show loading state
      setDisconnectingWallet(walletName);
      
      // First update local UI state immediately for responsive feel
      setLocalWallets(prev => prev.map(w => 
        w.name === walletName ? { ...w, connected: false } : w
      ));
      
      // Then call the parent component's disconnect handler
      await onDisconnect(walletName);
      
      // Disconnection should be handled by event listeners,
      // but we'll make sure the loading state is cleared
      setTimeout(() => {
        if (disconnectingWallet === walletName) {
          setDisconnectingWallet(null);
        }
      }, 3000);
    } catch (error) {
      console.error(`Error disconnecting from ${walletName}:`, error);
      setDisconnectingWallet(null);
      toast.error(`Failed to disconnect from ${walletName}. Please try again.`);
    }
  };
  
  return (
    <Card className="bg-[#121021] border border-[#5d43ef]/20 rounded-2xl p-8">
      <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold text-white mb-6">
           Wallet Connections
           <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a5 5 0 00-10 0v2M5 9h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2z" /></svg>
         </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {localWallets.map((wallet) => (
            <div
              key={wallet.name}
              className={`flex items-center justify-between p-4 rounded-xl bg-[#1b1930] hover:border-[#5d43ef] transition-all duration-300 ${wallet.connected ? "ring-1 ring-green-600" : ""}`}
            >
              <div className="flex items-center gap-3">
                <img src={wallet.icon} alt={wallet.name} className="h-6 w-6" />
                <div>
                  <div className="text-sm font-medium text-white">{wallet.name}</div>
                  {wallet.connected && <div className="text-xs text-green-400 font-semibold">Connected</div>}
                </div>
              </div>
              {wallet.connected ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-red-400 hover:bg-red-500/10"
                  onClick={() => handleDisconnectClick(wallet.name)}
                  disabled={disconnectingWallet === wallet.name}
                >
                  {disconnectingWallet === wallet.name ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    "Disconnect"
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white hover:bg-black"
                  onClick={() => handleConnectClick(wallet.name)}
                  disabled={connectingWallet === wallet.name}
                >
                  {connectingWallet === wallet.name ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default WalletConnectionsSection;
