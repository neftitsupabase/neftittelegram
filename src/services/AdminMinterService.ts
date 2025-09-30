import { createThirdwebClient, getContract, sendTransaction } from "thirdweb";
import { polygonAmoy } from "thirdweb/chains";
import { privateKeyToAccount } from "thirdweb/wallets";
import { contractPermissionService } from './ContractPermissionService';

/**
 * Admin Minter Service - Handles automatic MINTER_ROLE granting
 * Uses admin private key to grant permissions to user wallets
 */
export class AdminMinterService {
  private client: any;
  private contract: any;
  private adminAccount: any;
  private contractAddress: string;

  constructor() {
    this.contractAddress = import.meta.env.VITE_NFT_CLAIM_CONTRACT_ADDRESS || "0x5Bb23220cC12585264fCd144C448eF222c8572A2";
    
    // Initialize Thirdweb client
    this.client = createThirdwebClient({
      clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID!,
    });

    // Get contract instance
    this.contract = getContract({
      client: this.client,
      chain: polygonAmoy,
      address: this.contractAddress,
    });

    // Initialize admin account from private key (if available)
    this.initializeAdminAccount();
  }

  private initializeAdminAccount() {
    try {
      const adminPrivateKey = import.meta.env.VITE_ADMIN_PRIVATE_KEY;
      if (adminPrivateKey) {
        this.adminAccount = privateKeyToAccount({
          client: this.client,
          privateKey: adminPrivateKey,
        });
        console.log('✅ Admin account initialized for automatic role granting');
      } else {
        console.warn('⚠️ No admin private key found. Manual role granting required.');
      }
    } catch (error) {
      console.error('❌ Failed to initialize admin account:', error);
    }
  }

  /**
   * Automatically grant MINTER_ROLE to a user wallet
   * Uses admin account to execute the transaction
   */
  async grantMinterRoleToUser(userWalletAddress: string): Promise<{success: boolean, txHash?: string, message: string}> {
    try {
      console.log('🔑 Attempting to grant MINTER_ROLE to:', userWalletAddress);

      // Check if user already has the role
      const hasRole = await contractPermissionService.hasMinterRole(userWalletAddress);
      if (hasRole) {
        return {
          success: true,
          message: 'User already has MINTER_ROLE'
        };
      }

      // Check if admin account is available
      if (!this.adminAccount) {
        return {
          success: false,
          message: 'Admin account not configured. Please set VITE_ADMIN_PRIVATE_KEY in environment variables.'
        };
      }

      // Prepare the grant role transaction
      const grantTransaction = contractPermissionService.prepareGrantMinterRole(userWalletAddress);

      // Execute transaction with admin account
      const result = await sendTransaction({
        transaction: grantTransaction,
        account: this.adminAccount
      });

      console.log('✅ MINTER_ROLE granted successfully:', result.transactionHash);

      return {
        success: true,
        txHash: result.transactionHash,
        message: 'MINTER_ROLE granted successfully'
      };

    } catch (error: any) {
      console.error('❌ Failed to grant MINTER_ROLE:', error);
      
      let errorMessage = 'Failed to grant MINTER_ROLE';
      
      if (error.message?.includes('AccessControl')) {
        errorMessage = 'Admin account does not have permission to grant roles';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Admin account has insufficient MATIC for transaction';
      } else if (error.message?.includes('User denied')) {
        errorMessage = 'Transaction was rejected';
      }

      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Batch grant MINTER_ROLE to multiple wallets
   * Useful for onboarding multiple users
   */
  async batchGrantMinterRole(walletAddresses: string[]): Promise<{
    successful: string[],
    failed: {address: string, reason: string}[]
  }> {
    const successful: string[] = [];
    const failed: {address: string, reason: string}[] = [];

    for (const address of walletAddresses) {
      try {
        const result = await this.grantMinterRoleToUser(address);
        if (result.success) {
          successful.push(address);
        } else {
          failed.push({address, reason: result.message});
        }
      } catch (error: any) {
        failed.push({address, reason: error.message || 'Unknown error'});
      }
    }

    return { successful, failed };
  }

  /**
   * Check admin account status and permissions
   */
  async getAdminStatus(): Promise<{
    hasAdminAccount: boolean,
    adminAddress?: string,
    hasAdminRole?: boolean,
    balance?: string
  }> {
    try {
      if (!this.adminAccount) {
        return { hasAdminAccount: false };
      }

      const adminAddress = this.adminAccount.address;
      const hasAdminRole = await contractPermissionService.hasAdminRole(adminAddress);

      // Get admin account balance (simplified)
      let balance = 'Unknown';
      try {
        // For now, we'll skip balance fetching to avoid API complexity
        // In production, you can implement proper balance checking
        balance = 'Available';
      } catch (balanceError) {
        console.warn('Could not fetch admin balance:', balanceError);
      }

      return {
        hasAdminAccount: true,
        adminAddress,
        hasAdminRole,
        balance
      };

    } catch (error) {
      console.error('Error checking admin status:', error);
      return { hasAdminAccount: false };
    }
  }

  /**
   * Get all addresses with MINTER_ROLE
   */
  async getAllMinterAddresses(): Promise<string[]> {
    try {
      return await contractPermissionService.getMinterAddresses();
    } catch (error) {
      console.error('Error getting minter addresses:', error);
      return [];
    }
  }
}

export const adminMinterService = new AdminMinterService();
