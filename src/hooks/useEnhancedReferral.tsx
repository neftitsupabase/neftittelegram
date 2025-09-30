import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { referralService, ReferralData } from '@/services/ReferralService';
import { enhancedReferralService, ReferralEligibility } from '@/services/EnhancedReferralService';
import { useAuthState } from './useAuthState';

export function useEnhancedReferral() {
  const { walletAddress, isAuthenticated } = useAuthState();

  const [referralData, setReferralData] = useState<ReferralData>({
    code: '',
    link: '',
    count: 0,
    rewards: 0,
  });
  const [eligibility, setEligibility] = useState<ReferralEligibility>({
    eligible: false,
    completed_projects: 0,
    required_projects: 2,
    remaining_projects: 2
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadReferralData = useCallback(async () => {
    if (!walletAddress || !isAuthenticated) {
      setReferralData({
        code: '',
        link: '',
        count: 0,
        rewards: 0,
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('Loading referral data for wallet:', walletAddress);
      const data = await referralService.getReferralData(walletAddress);
      if (mountedRef.current) {
        setReferralData(data);
      }
      console.log('Referral data loaded:', data);
    } catch (error) {
      console.error('Error loading referral data:', error);
      toast.error('Failed to load referral data');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [walletAddress, isAuthenticated]);

  const checkEligibility = useCallback(async () => {
    if (!walletAddress || !isAuthenticated) {
      setEligibility({
        eligible: false,
        completed_projects: 0,
        required_projects: 2,
        remaining_projects: 2
      });
      return;
    }

    try {
      const eligibilityData = await enhancedReferralService.checkReferralEligibility(walletAddress);
      if (mountedRef.current) {
        setEligibility(eligibilityData);
      }
    } catch (error) {
      console.error('Error checking referral eligibility:', error);
    }
  }, [walletAddress, isAuthenticated]);

  // Load data whenever wallet changes or connects
  useEffect(() => {
    loadReferralData();
    checkEligibility();
  }, [loadReferralData, checkEligibility]);

  const toggleModal = useCallback(() => {
    setIsModalOpen(prev => {
      const nextState = !prev;
      if (nextState && walletAddress) {
        loadReferralData();
        checkEligibility();
      }
      return nextState;
    });
  }, [walletAddress, loadReferralData, checkEligibility]);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
    if (walletAddress) {
      loadReferralData();
      checkEligibility();
    }
  }, [walletAddress, loadReferralData, checkEligibility]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const copyReferralLink = useCallback(async () => {
    if (!referralData.link) {
      toast.error('Referral link not available');
      return;
    }
    try {
      await navigator.clipboard.writeText(referralData.link);
      toast.success('Referral link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy. Please try again.');
      console.error('Failed to copy: ', error);
    }
  }, [referralData.link]);

  const processReferral = useCallback(
    async (referrerWallet: string) => {
      console.log('🎯 useEnhancedReferral: Starting referral process...', { referrerWallet, walletAddress, isAuthenticated });

      if (!walletAddress || !isAuthenticated) {
        console.log('❌ useEnhancedReferral: Wallet not connected or not authenticated');
        toast.error('Please connect your wallet first');
        return false;
      }

      if (referrerWallet === walletAddress) {
        console.log('❌ useEnhancedReferral: Self-referral attempt blocked');
        toast.error('You cannot refer yourself');
        return false;
      }

      try {
        console.log('🚀 useEnhancedReferral: Calling enhancedReferralService.processReferralWithValidation...');
        const result = await enhancedReferralService.processReferralWithValidation(
          referrerWallet,
          walletAddress
        );

        console.log('📊 useEnhancedReferral: Process referral result:', result);

        if (result.success) {
          console.log('✅ useEnhancedReferral: Referral processed successfully, refreshing data...');
          toast.success('Referral processed successfully! Rewards have been distributed.');
          await loadReferralData();
          return true;
        } else {
          console.log('❌ useEnhancedReferral: Referral processing failed:', result.error);
          
          if (result.completed_projects !== undefined && result.required_projects !== undefined) {
            toast.error(`Complete ${result.required_projects - result.completed_projects} more projects to activate referral (${result.completed_projects}/${result.required_projects})`);
          } else {
            toast.error(result.error || 'Referral processing failed');
          }
          return false;
        }
      } catch (error) {
        console.error('💥 useEnhancedReferral: Error processing referral:', error);
        toast.error('Error processing referral');
        return false;
      }
    },
    [walletAddress, isAuthenticated, loadReferralData]
  );

  const validateReferralCode = useCallback(async (referralCode: string) => {
    try {
      console.log('🎯 useEnhancedReferral: Starting validation for code:', referralCode);
      const result = await referralService.validateReferralCode(referralCode);
      console.log('🎯 useEnhancedReferral: Validation result:', result);

      if (result.valid && result.referrerWallet) {
        console.log('✅ useEnhancedReferral: Valid referral code, referrer:', result.referrerWallet);
        return result.referrerWallet;
      } else {
        console.log('❌ useEnhancedReferral: Invalid referral code');
        return null;
      }
    } catch (error) {
      console.error('💥 useEnhancedReferral: Error validating referral code:', error);
      return null;
    }
  }, []);

  return {
    referralData,
    eligibility,
    isModalOpen,
    isLoading,
    toggleModal,
    openModal,
    closeModal,
    copyReferralLink,
    processReferral,
    validateReferralCode,
    refreshData: loadReferralData,
    checkEligibility
  };
}
