import { useEffect, useRef } from 'react';
import { useReferral } from './useReferral';
import { toast } from 'sonner';

interface UseReferralProcessorProps {
  walletAddress: string | null;
  isAuthenticated: boolean;
}

export function useReferralProcessor({ walletAddress, isAuthenticated }: UseReferralProcessorProps) {
  const { processReferral } = useReferral();
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    const processPendingReferral = async () => {
      // Only process if wallet is connected and authenticated
      if (!walletAddress || !isAuthenticated || hasProcessedRef.current) {
        return;
      }

      // Check for pending referral data
      const pendingCode = localStorage.getItem('pending_referral_code');
      const pendingReferrer = localStorage.getItem('pending_referrer_wallet');

      if (!pendingCode || !pendingReferrer) {
        return;
      }

      // Prevent multiple processing attempts
      hasProcessedRef.current = true;

      try {
        console.log('🎯 Processing pending referral after wallet connection:', {
          referrer: pendingReferrer,
          referred: walletAddress,
          code: pendingCode
        });

        const success = await processReferral(pendingReferrer);

        if (success) {
          toast.success('🎉 Welcome! Your referral bonus has been processed!', {
            description: 'Your referrer earned 5 NEFT tokens!'
          });
          
          // Clean up pending referral data
          localStorage.removeItem('pending_referral_code');
          localStorage.removeItem('pending_referrer_wallet');
          
          console.log('✅ Referral processed successfully and cleaned up');
        } else {
          console.log('❌ Referral processing failed - may be duplicate or invalid');
          toast.error('Referral processing failed. You may have already been referred.');
          
          // Clean up failed referral data
          localStorage.removeItem('pending_referral_code');
          localStorage.removeItem('pending_referrer_wallet');
        }
      } catch (error) {
        console.error('💥 Error processing pending referral:', error);
        toast.error('Error processing referral');
        
        // Clean up on error
        localStorage.removeItem('pending_referral_code');
        localStorage.removeItem('pending_referrer_wallet');
      }
    };

    // Small delay to ensure wallet connection is fully established
    const timeoutId = setTimeout(processPendingReferral, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [walletAddress, isAuthenticated, processReferral]);

  // Reset processing flag when wallet disconnects
  useEffect(() => {
    if (!walletAddress || !isAuthenticated) {
      hasProcessedRef.current = false;
    }
  }, [walletAddress, isAuthenticated]);
}
