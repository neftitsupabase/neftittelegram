import { useState } from 'react';
import { autoMinterService } from '../services/AutoMinterService';
import { web3MetaMaskNFTService } from '../services/Web3MetaMaskNFTService';

/**
 * React hook for automatic MINTER_ROLE management and NFT minting
 * Provides seamless NFT minting with automatic permission handling
 */
export const useAutoMinter = () => {
  const [isGrantingRole, setIsGrantingRole] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [roleGrantStatus, setRoleGrantStatus] = useState<{
    success: boolean;
    message: string;
    txHash?: string;
  } | null>(null);

  /**
   * Ensure a user has MINTER_ROLE
   */
  const ensureMinterRole = async (walletAddress: string) => {
    setIsGrantingRole(true);
    setRoleGrantStatus(null);

    try {
      const result = await autoMinterService.ensureMinterRole(walletAddress);
      setRoleGrantStatus(result);
      return result;
    } catch (error: any) {
      const errorResult = {
        success: false,
        message: error.message || 'Failed to ensure MINTER_ROLE'
      };
      setRoleGrantStatus(errorResult);
      return errorResult;
    } finally {
      setIsGrantingRole(false);
    }
  };

  /**
   * Mint NFT with automatic role granting
   * This is the main function components should use
   */
  const mintNFTWithAutoRole = async (nftId: string, walletAddress: string) => {
    setIsMinting(true);
    setRoleGrantStatus(null);

    try {
      // The Web3MetaMaskNFTService now automatically handles role granting
      const result = await web3MetaMaskNFTService.mintNFT(nftId, walletAddress);
      return result;
    } catch (error: any) {
      throw error;
    } finally {
      setIsMinting(false);
    }
  };

  /**
   * Batch ensure MINTER_ROLE for multiple users
   */
  const ensureMinterRoleBatch = async (walletAddresses: string[]) => {
    setIsGrantingRole(true);

    try {
      const result = await autoMinterService.ensureMinterRoleBatch(walletAddresses);
      return result;
    } catch (error: any) {
      throw error;
    } finally {
      setIsGrantingRole(false);
    }
  };

  /**
   * Clear role cache for better performance
   */
  const clearRoleCache = (walletAddress?: string) => {
    autoMinterService.clearRoleCache(walletAddress);
  };

  /**
   * Get cache statistics
   */
  const getCacheStats = () => {
    return autoMinterService.getCacheStats();
  };

  return {
    // State
    isGrantingRole,
    isMinting,
    roleGrantStatus,
    isLoading: isGrantingRole || isMinting,

    // Functions
    ensureMinterRole,
    mintNFTWithAutoRole,
    ensureMinterRoleBatch,
    clearRoleCache,
    getCacheStats,
  };
};
