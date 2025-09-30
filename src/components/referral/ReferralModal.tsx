import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Gift, Users, Share2 } from 'lucide-react';
import CopyLinkButton from './CopyLinkButton';
import { referralService } from '@/services/ReferralService';

interface ReferralModalProps {
  isOpen: boolean;
  referralData: {
    code: string;
    link: string;
    count: number;
    rewards: number;
  };
  isLoading?: boolean;
  onToggle: () => void;
  onCopyLink: () => Promise<void>;
}

const ReferralModal: React.FC<ReferralModalProps> = ({
  isOpen,
  referralData,
  isLoading,
  onToggle,
  onCopyLink
}) => {
  const flatReward = referralService.getFlatReward();

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[9999]"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop (click to close) */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onToggle}
      />

      {/* Layer that centers the modal; pointer events only on the card */}
      <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-3 md:p-4 pointer-events-none">
        <div
          className="pointer-events-auto relative w-full max-w-md sm:max-w-lg md:max-w-sm lg:max-w-md transform overflow-hidden rounded-2xl bg-[#121021] p-4 sm:p-5 md:p-4 text-white shadow-[0_0_50px_-12px] shadow-purple-500/20 border border-white/10 transition-all animate-in fade-in-0 zoom-in-95 duration-300"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="absolute right-2 sm:right-3 md:right-4 top-2 sm:top-3 md:top-4">
            <button
              onClick={onToggle}
              className="rounded-full p-1 sm:p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close dialog"
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mb-6 sm:mb-8 md:mb-6">
            <div className="flex items-center justify-center mb-3 sm:mb-4 md:mb-3">
              <div className="relative">
                <div className="absolute inset-0 bg-[#5d43ef] blur-2xl opacity-20 rounded-full" />
                <div className="relative h-16 w-16 rounded-2xl bg-[#5d43ef] flex items-center justify-center transform rotate-12">
                  <Share2 className="text-white transform -rotate-12" size={24} />
                </div>
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold bg-[#5d43ef] bg-clip-text text-transparent">
              Refer & Earn Rewards
            </h3>
            <p className="text-xs sm:text-sm text-gray-400 max-w-xs sm:max-w-sm mx-auto ml-1 sm:m1-1">
              Invite your friends to join NEFTIT and earn 5 NEFT for each successful referral
            </p>
          </div>

          <div className="mt-3 sm:mt-4 md:mt-3 rounded-xl border border-white/10 bg-gradient-to-r from-[#5d43ef]/10 to-[#19172d]/10 backdrop-blur-sm p-3 sm:p-4 md:p-3 mb-6 sm:mb-8 md:mb-6">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-2 mb-3 sm:mb-4 md:mb-3">
              <Users size={16} className="text-[#5d43ef] sm:size-[18px]" />
              <span className="text-xs sm:text-sm font-medium text-white/90">Your Referral Stats</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-3 text-center">
              <div className="rounded-xl bg-[#121021] p-3 sm:p-4 md:p-3 border border-white/5">
                <p className="text-2xl sm:text-3xl font-bold bg-[#5d43ef] bg-clip-text text-transparent">
                  {referralData.count}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-1">Total Referrals</p>
              </div>
              <div className="rounded-xl bg-[#121021] p-3 sm:p-4 md:p-3 border border-white/5">
                <p className="text-2xl sm:text-3xl font-bold bg-[#5d43ef] bg-clip-text text-transparent">
                  {referralData.rewards}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-1">NEFT Earned</p>
              </div>
            </div>
          </div>

          <div className="sm:space-y-2 md:space-y-3">
            {/* Referral Link */}
            <div className="space-y-2 sm:space-y-3 md:space-y-2">
              <h4 className="text-xs sm:text-sm font-medium flex items-center gap-2 text-white/90">
                <Gift size={14} className="text-[#5d43ef] sm:size-[16px]" />
                Your Referral Link
              </h4>
              <CopyLinkButton
                referralLink={referralData.link}
                onCopy={onCopyLink}
                isLoading={isLoading}
              />
            </div>

            {/* Rewards */}
            <div className="space-y-2  sm:space-y-3 md:space-y-2 bg-gradient-to-br from-[#1a152b] to-[#0f0c1a] rounded-xl p-3 sm:p-4 md:p-3 border border-white/5">
              <div className="space-y-3 md:space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs sm:text-sm font-medium flex items-center gap-2 text-white/90">
                    <Gift size={14} className="text-[#5d43ef] sm:size-[16px]" />
                    <span>Referral Rewards</span>
                  </h4>
                  <span className="text-xs sm:text-sm font-medium text-[#5d43ef]">+{flatReward.neftReward} NEFT</span>
                </div>

                <p className="text-xs sm:text-sm text-gray-400">
                  Your referral count will increase only when the user who joins through your referral link successfully completes 2 campaigns.
                </p>
              </div>
            </div>
            
            <p className="text-[10px] sm:text-xs text-gray-500 text-center mt-4 sm:mt-6 md:mt-4">
              Share this link with your friends to start earning rewards
            </p>
          </div>

        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default ReferralModal;
