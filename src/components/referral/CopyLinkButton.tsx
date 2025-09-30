import React, { useState } from 'react';
import { Copy, Check, Link as LinkIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyLinkButtonProps {
  referralLink: string;
  onCopy?: () => Promise<void>;
  className?: string;
  isLoading?: boolean;
}

const CopyLinkButton: React.FC<CopyLinkButtonProps> = ({
  referralLink,
  onCopy,
  className,
  isLoading
}) => {
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    try {
      // 🔥 Force focus to keep browser happy in portals
      if (e?.currentTarget instanceof HTMLElement) {
        e.currentTarget.focus();
      }

      // Try Clipboard API
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralLink);
      } else {
        throw new Error("Clipboard API not available");
      }

      // Success
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      if (onCopy) await onCopy();
    } catch {
      // 🔥 Fallback to execCommand
      try {
        const textarea = document.createElement('textarea');
        textarea.value = referralLink;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);

        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
        if (onCopy) await onCopy();
      } catch {
        console.error("Failed to copy referral link");
      }
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="relative flex overflow-hidden rounded-xl border border-white/10 bg-[#1b1930] shadow-lg">
        {/* Link Display */}
        <div
          className="relative flex-1 overflow-hidden px-4 py-3 bg-transparent cursor-pointer"
          onClick={handleCopy}
          role="button"
          aria-label="Copy referral link"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCopy(e);
            }
          }}
        >
          <div className="flex items-center gap-2">
            <LinkIcon size={14} className="text-[#5d43ef]" />
            <p className="truncate text-sm text-gray-300 font-medium">{referralLink}</p>
          </div>
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          disabled={isLoading || !referralLink}
          className={cn(
            "relative flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all duration-300",
            isLoading || !referralLink
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-[#5d43ef] hover:bg-[#4a35d1]",
            "focus:outline-none focus:ring-2 focus:ring-[#5d43ef]/20 focus:ring-offset-2 focus:ring-offset-[#1b1930]"
          )}
          type="button"
          aria-label="Copy referral link"
          title="Copy referral link"
        >
          <div className="relative flex items-center gap-2">
            {isLoading ? (
              <>
                <Loader2 size={16} className="text-white animate-spin" />
                <span className="hidden sm:inline text-white">Loading...</span>
              </>
            ) : copied ? (
              <>
                <Check size={16} className="text-white" />
                <span className="hidden sm:inline text-white">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={16} className="text-white" />
                <span className="hidden sm:inline text-white">Copy</span>
              </>
            )}
          </div>
        </button>
      </div>

      {/* Success Message */}
      <div
        className={cn(
          "flex items-center justify-center mt-2 transition-all duration-300",
          copied ? "opacity-100 transform translate-y-0" : "opacity-0 transform -translate-y-2"
        )}
      >
        <p className="text-xs text-purple-400">
          Link copied to clipboard! Share it with your friends
        </p>
      </div>
    </div>
  );
};

export default CopyLinkButton;
