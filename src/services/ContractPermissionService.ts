import { createThirdwebClient, getContract, prepareContractCall, type PreparedTransaction } from "thirdweb";
import { polygonAmoy } from "thirdweb/chains";
import { useSendTransaction } from "thirdweb/react";

/**
 * Contract Permission Service - Manages NFT contract permissions
 * Allows granting/revoking MINTER_ROLE and other permissions
 */
export class ContractPermissionService {
  private client: any;
  private contract: any;
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
  }

  /**
   * Get the MINTER_ROLE bytes32 value
   * This is typically keccak256("MINTER_ROLE")
   */
  getMinterRole(): `0x${string}` {
    // MINTER_ROLE = keccak256("MINTER_ROLE")
    return "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
  }

  /**
   * Get the DEFAULT_ADMIN_ROLE bytes32 value
   */
  getAdminRole(): `0x${string}` {
    // DEFAULT_ADMIN_ROLE = 0x00...00
    return "0x0000000000000000000000000000000000000000000000000000000000000000";
  }

  /**
   * Validate and format address to ensure it's a proper 0x prefixed hex string
   */
  private validateAndFormatAddress(address: string): `0x${string}` {
    if (!address) {
      throw new Error('Address cannot be empty');
    }
    
    // Remove any whitespace
    const cleanAddress = address.trim();
    
    // Check if it starts with 0x, if not add it
    const formattedAddress = cleanAddress.startsWith('0x') ? cleanAddress : `0x${cleanAddress}`;
    
    // Validate it's a proper hex string with correct length
    if (!/^0x[a-fA-F0-9]{40}$/.test(formattedAddress)) {
      throw new Error(`Invalid Ethereum address format: ${address}`);
    }
    
    return formattedAddress as `0x${string}`;
  }

  /**
   * Prepare transaction to grant MINTER_ROLE to an address
   * Must be called by an account with DEFAULT_ADMIN_ROLE
   */
  prepareGrantMinterRole(accountAddress: string): PreparedTransaction {
    const address = this.validateAndFormatAddress(accountAddress);
    return prepareContractCall({
      contract: this.contract,
      method: "function grantRole(bytes32 role, address account)",
      params: [this.getMinterRole(), address],
    }) as PreparedTransaction;
  }

  /**
   * Prepare transaction to revoke MINTER_ROLE from an address
   */
  prepareRevokeMinterRole(accountAddress: string): PreparedTransaction {
    const address = this.validateAndFormatAddress(accountAddress);
    return prepareContractCall({
      contract: this.contract,
      method: "function revokeRole(bytes32 role, address account)",
      params: [this.getMinterRole(), address],
    }) as PreparedTransaction;
  }

  /**
   * Prepare transaction to grant admin role to an address
   */
  prepareGrantAdminRole(accountAddress: string): PreparedTransaction {
    const address = this.validateAndFormatAddress(accountAddress);
    return prepareContractCall({
      contract: this.contract,
      method: "function grantRole(bytes32 role, address account)",
      params: [this.getAdminRole(), address],
    }) as PreparedTransaction;
  }

  /**
   * Check if an address has MINTER_ROLE
   */
  async hasRole(role: `0x${string}`, accountAddress: string): Promise<boolean> {
    try {
      const { readContract } = await import("thirdweb");
      
      const address = this.validateAndFormatAddress(accountAddress);
      const result = await readContract({
        contract: this.contract,
        method: "function hasRole(bytes32 role, address account) view returns (bool)",
        params: [role, address],
      });
      
      return result;
    } catch (error) {
      console.error('Error checking role:', error);
      return false;
    }
  }

  /**
   * Check if an address has MINTER_ROLE
   */
  async hasMinterRole(accountAddress: string): Promise<boolean> {
    return this.hasRole(this.getMinterRole(), accountAddress);
  }

  /**
   * Check if an address has admin role
   */
  async hasAdminRole(accountAddress: string): Promise<boolean> {
    return this.hasRole(this.getAdminRole(), accountAddress);
  }

  /**
   * Get all addresses with MINTER_ROLE
   * Note: This requires event filtering which may need additional setup
   */
  async getMinterAddresses(): Promise<string[]> {
    try {
      const { getContractEvents, prepareEvent } = await import("thirdweb");
      
      // Prepare the RoleGranted event
      const roleGrantedEvent = prepareEvent({
        signature: "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)"
      });
      
      // Get RoleGranted events for MINTER_ROLE
      const events = await getContractEvents({
        contract: this.contract,
        events: [roleGrantedEvent],
        fromBlock: 0n,
      });

      const minterRole = this.getMinterRole();
      const minterAddresses: string[] = [];

      for (const event of events) {
        // Type assertion for RoleGranted event args
        const args = event.args as { role: string; account: string; sender: string };
        if (args.role === minterRole) {
          minterAddresses.push(args.account);
        }
      }

      // Remove duplicates and check if roles are still active
      const uniqueAddresses = [...new Set(minterAddresses)];
      const activeMinters: string[] = [];

      for (const address of uniqueAddresses) {
        if (await this.hasMinterRole(address)) {
          activeMinters.push(address);
        }
      }

      return activeMinters;
    } catch (error) {
      console.error('Error getting minter addresses:', error);
      return [];
    }
  }
}

export const contractPermissionService = new ContractPermissionService();

/**
 * React Hook for granting minter permissions
 * Usage in React component:
 */
export function useGrantMinterRole() {
  const { mutate: sendTransaction } = useSendTransaction();

  const grantMinterRole = (accountAddress: string) => {
    const transaction = contractPermissionService.prepareGrantMinterRole(accountAddress);
    sendTransaction(transaction);
  };

  const revokeMinterRole = (accountAddress: string) => {
    const transaction = contractPermissionService.prepareRevokeMinterRole(accountAddress);
    sendTransaction(transaction);
  };

  return {
    grantMinterRole,
    revokeMinterRole,
  };
}

/**
 * Example usage in a React Component:
 * 
 * function PermissionManager() {
 *   const { grantMinterRole, revokeMinterRole } = useGrantMinterRole();
 * 
 *   const handleGrantMinter = (address: string) => {
 *     grantMinterRole(address);
 *   };
 * 
 *   const handleRevokeMinter = (address: string) => {
 *     revokeMinterRole(address);
 *   };
 * 
 *   return (
 *     <div className="permission-manager">
 *       <h3>Manage Minter Permissions</h3>
 *       <button onClick={() => handleGrantMinter("0x123...")}>
 *         Grant Minter Role
 *       </button>
 *       <button onClick={() => handleRevokeMinter("0x123...")}>
 *         Revoke Minter Role
 *       </button>
 *     </div>
 *   );
 * }
 */
