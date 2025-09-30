import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Gift, Users, Sparkles } from 'lucide-react';
import { referralService } from '@/services/ReferralService';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useReferral } from '@/hooks/useReferral';
import { toast } from 'sonner';
import { useAuthState } from '@/hooks/useAuthState';

const ReferralInvite: React.FC = () => {
  const { referralCode } = useParams<{ referralCode: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, walletAddress } = useAuthState();
  const { processReferral } = useReferral();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [referrerInfo, setReferrerInfo] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Validate referral code on mount
  useEffect(() => {
    const validateCode = async () => {
      if (!referralCode) {
        setIsValidating(false);
        return;
      }

      try {
        const result = await referralService.validateReferralCode(referralCode);
        setIsValid(result.valid);
        setReferrerInfo(result.referrerWallet || null);
        
        if (result.valid) {
          // Store referral code for later processing
          localStorage.setItem('pending_referral_code', referralCode);
          localStorage.setItem('pending_referrer_wallet', result.referrerWallet || '');
        }
      } catch (error) {
        console.error('Error validating referral code:', error);
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateCode();
  }, [referralCode]);

  // Process referral when wallet connects
  useEffect(() => {
    const processPendingReferral = async () => {
      if (!isAuthenticated || !walletAddress || isProcessing) return;

      const pendingCode = localStorage.getItem('pending_referral_code');
      const pendingReferrer = localStorage.getItem('pending_referrer_wallet');

      if (pendingCode && pendingReferrer && pendingCode === referralCode) {
        setIsProcessing(true);
        
        try {
          console.log('🎯 Processing pending referral:', { pendingReferrer, walletAddress });
          const success = await processReferral(pendingReferrer);
          
          if (success) {
            toast.success('🎉 Welcome! Your referral reward has been processed!');
            // Clean up pending referral data
            localStorage.removeItem('pending_referral_code');
            localStorage.removeItem('pending_referrer_wallet');
            
            // Navigate to home after successful processing
            setTimeout(() => navigate('/home'), 2000);
          } else {
            toast.error('Referral processing failed. You may have already been referred.');
          }
        } catch (error) {
          console.error('Error processing referral:', error);
          toast.error('Error processing referral');
        } finally {
          setIsProcessing(false);
        }
      }
    };

    processPendingReferral();
  }, [isAuthenticated, walletAddress, referralCode, processReferral, navigate, isProcessing]);

  if (isValidating) {
    return (
      <div className="min-h-screen bg-[#0F1114] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5d43ef] mx-auto mb-4"></div>
          <p className="text-white">Validating referral code...</p>
        </div>
      </div>
    );
  }

  if (!isValid || !referralCode) {
    return (
      <div className="min-h-screen bg-[#0F1114] flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Gift className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Invalid Referral Link</h1>
          <p className="text-gray-400 mb-6">
            This referral link is invalid or has expired.
          </p>
          <Button 
            onClick={() => navigate('/')}
            className="bg-[#5d43ef] hover:bg-[#5d43ef]/80 text-white"
          >
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1114] flex items-center justify-center p-4">
      <div className="max-w-md mx-auto text-center">
        <div className="bg-[#121021] border border-white/10 rounded-2xl p-8 shadow-xl">
          {/* Success Icon */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-[#5d43ef] blur-2xl opacity-20 rounded-full" />
            <div className="relative w-20 h-20 bg-[#5d43ef] rounded-2xl flex items-center justify-center mx-auto transform rotate-12">
              <Gift className="w-10 h-10 text-white transform -rotate-12" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            You've Been Invited!
          </h1>
          <p className="text-gray-400 mb-6">
            Join NEFTIT and start earning rewards together
          </p>

          {/* Referrer Info */}
          <div className="bg-[#5d43ef]/10 border border-[#5d43ef]/20 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Users className="w-4 h-4 text-[#5d43ef]" />
              <span className="text-sm text-gray-300">Invited by</span>
            </div>
            <p className="text-[#5d43ef] font-mono text-sm break-all">
              {referrerInfo ? `${referrerInfo.slice(0, 8)}...${referrerInfo.slice(-6)}` : 'Friend'}
            </p>
          </div>

          {/* Action Button */}
          {!isAuthenticated ? (
            <div>
              <Button 
                onClick={() => navigate('/')}
                className="w-full bg-[#5d43ef] hover:bg-[#5d43ef]/80 text-white"
              >
                Login & Join
              </Button>
            </div>
          ) : isProcessing ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#5d43ef] mx-auto mb-2"></div>
              <p className="text-sm text-gray-400">Processing referral...</p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-green-400 mb-4">
                ✅ Wallet connected! Processing your referral...
              </p>
              <Button 
                onClick={() => navigate('/')}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferralInvite;
