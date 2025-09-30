import React, { useMemo } from 'react';
import { Copy, ExternalLink, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { formatWalletAddress } from '@/utils/authUtils';

/**
 * Properties for the WalletAddress component
 */
export interface WalletAddressProps {
  /** The wallet address to display */
  address: string;
  /** Whether to show copy button */
  showCopy?: boolean;
  /** Whether to show explorer link */
  showExplorer?: boolean;
  /** Number of characters to show at the start (default: 6) */
  prefixLength?: number;
  /** Number of characters to show at the end (default: 4) */
  suffixLength?: number;
  /** Explorer URL, if not provided will use default based on network */
  explorerUrl?: string;
  /** Network ID for determining explorer URL */
  networkId?: number | string;
  /** Optional chain name for tooltip */
  chainName?: string;
  /** Optional CSS class names */
  className?: string;
  /** Optional CSS class for the address text */
  textClassName?: string;
  /** Whether to show the full address instead of truncated */
  showFull?: boolean;
  /** Optional custom formatter for the address */
  formatter?: (address: string) => string;
  /** Optional callback when address is clicked */
  onClick?: () => void;
}

/**
 * Gets the explorer URL for a given address and network
 */
const getExplorerUrl = (address: string, networkId?: number | string): string => {
  // Default to Ethereum mainnet
  if (!networkId) return `https://etherscan.io/address/${address}`;
  
  // Map of network IDs to explorer URLs
  const explorerMap: Record<string, string> = {
    '1': 'https://etherscan.io',          // Ethereum Mainnet
    '5': 'https://goerli.etherscan.io',   // Goerli Testnet
    '11155111': 'https://sepolia.etherscan.io', // Sepolia Testnet
    '137': 'https://polygonscan.com',     // Polygon
    '80001': 'https://mumbai.polygonscan.com', // Mumbai Testnet
    '56': 'https://bscscan.com',          // Binance Smart Chain
    '43114': 'https://snowtrace.io',      // Avalanche
    '42161': 'https://arbiscan.io',       // Arbitrum
    '10': 'https://optimistic.etherscan.io', // Optimism
  };
  
  const baseUrl = explorerMap[networkId.toString()] || 'https://etherscan.io';
  return `${baseUrl}/address/${address}`;
};

/**
 * WalletAddress - A component for displaying and interacting with wallet addresses
 * 
 * Displays a wallet address with optional copy button and explorer link.
 * Address is automatically truncated for readability but can be configured.
 * 
 * @example
 * <WalletAddress 
 *   address="0x1234567890abcdef1234567890abcdef12345678" 
 *   showCopy 
 *   showExplorer 
 *   networkId={1}
 * />
 */
export const WalletAddress: React.FC<WalletAddressProps> = ({
  address,
  showCopy = true,
  showExplorer = false,
  prefixLength = 6,
  suffixLength = 4,
  explorerUrl,
  networkId,
  chainName,
  className,
  textClassName,
  showFull = false,
  formatter,
  onClick,
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  
  // Only recalculate formatted address when dependencies change
  const formattedAddress = useMemo(() => {
    if (formatter) return formatter(address);
    if (showFull) return address;
    return formatWalletAddress(address, prefixLength, suffixLength);
  }, [address, showFull, formatter, prefixLength, suffixLength]);
  
  // Generate explorer URL only when needed
  const explorerAddress = useMemo(() => {
    if (explorerUrl) return explorerUrl;
    return getExplorerUrl(address, networkId);
  }, [address, explorerUrl, networkId]);
  
  /**
   * Copies the wallet address to clipboard
   */
  const copyToClipboard = () => {
    try {
      navigator.clipboard.writeText(address);
      setCopied(true);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard",
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
      toast({
        title: "Copy Failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div 
      className={cn(
        "flex items-center font-mono text-sm gap-1.5",
        className
      )}
    >
      <span 
        className={cn(
          "text-white/80 hover:text-white transition-colors", 
          onClick && "cursor-pointer",
          textClassName
        )}
        onClick={onClick}
        title={showFull ? undefined : address}
      >
        {formattedAddress}
      </span>
      
      {showCopy && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10"
                onClick={copyToClipboard}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{copied ? 'Copied!' : 'Copy address'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      {showExplorer && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10"
                onClick={() => window.open(explorerAddress, '_blank')}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>View on {chainName || 'explorer'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};

export default WalletAddress; 