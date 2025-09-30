import Web3 from 'web3';
import { IPFS_GATEWAYS } from '../config/ipfsConfig';
import { supabase } from '../lib/supabase';
import { contractPermissionService } from './ContractPermissionService';
import { adminMinterService } from './AdminMinterService';
import { autoMinterService } from './AutoMinterService';

/**
 * Web3 MetaMask NFT Service - Uses Web3.js for better MetaMask integration
 */
export class Web3MetaMaskNFTService {
  private web3: Web3 | null = null;
  public contractAddress: string;
  private contractABI: any[];
  private rpcEndpoints: string[];
  private ipfsGateways: string[];

  constructor() {
    this.contractAddress = import.meta.env.VITE_NFT_CLAIM_CONTRACT_ADDRESS || "0x5Bb23220cC12585264fCd144C448eF222c8572A2";
    
    this.rpcEndpoints = [
      'https://rpc-amoy.polygon.technology/',
      'https://polygon-amoy.g.alchemy.com/v2/demo',
      'https://polygon-amoy.drpc.org'
    ];

    this.ipfsGateways = [...IPFS_GATEWAYS];

    // Complete contract ABI
    this.contractABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"CurrencyTransferLibFailedNativeTransfer","type":"error"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"NFTMetadataFrozen","type":"error"},{"inputs":[],"name":"NFTMetadataInvalidUrl","type":"error"},{"inputs":[],"name":"NFTMetadataUnauthorized","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"_fromTokenId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"_toTokenId","type":"uint256"}],"name":"BatchMetadataUpdate","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newRoyaltyRecipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"newRoyaltyBps","type":"uint256"}],"name":"DefaultRoyalty","type":"event"},{"anonymous":false,"inputs":[],"name":"EIP712DomainChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"platformFeeRecipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"flatFee","type":"uint256"}],"name":"FlatPlatformFeeUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"version","type":"uint8"}],"name":"Initialized","type":"event"},{"anonymous":false,"inputs":[],"name":"MetadataFrozen","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"MetadataUpdate","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"prevOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnerUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"platformFeeRecipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"platformFeeBps","type":"uint256"}],"name":"PlatformFeeInfoUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"enum IPlatformFee.PlatformFeeType","name":"feeType","type":"uint8"}],"name":"PlatformFeeTypeUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"recipient","type":"address"}],"name":"PrimarySaleRecipientUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"royaltyRecipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"royaltyBps","type":"uint256"}],"name":"RoyaltyForToken","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"mintedTo","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenIdMinted","type":"uint256"},{"indexed":false,"internalType":"string","name":"uri","type":"string"}],"name":"TokensMinted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"signer","type":"address"},{"indexed":true,"internalType":"address","name":"mintedTo","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenIdMinted","type":"uint256"},{"components":[{"internalType":"address","name":"to","type":"address"},{"internalType":"address","name":"royaltyRecipient","type":"address"},{"internalType":"uint256","name":"royaltyBps","type":"uint256"},{"internalType":"address","name":"primarySaleRecipient","type":"address"},{"internalType":"string","name":"uri","type":"string"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"address","name":"currency","type":"address"},{"internalType":"uint128","name":"validityStartTimestamp","type":"uint128"},{"internalType":"uint128","name":"validityEndTimestamp","type":"uint128"},{"internalType":"bytes32","name":"uid","type":"bytes32"}],"indexed":false,"internalType":"struct ITokenERC721.MintRequest","name":"mintRequest","type":"tuple"}],"name":"TokensMintedWithSignature","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEFAULT_FEE_RECIPIENT","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"burn","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"contractType","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"contractURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"contractVersion","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"eip712Domain","outputs":[{"internalType":"bytes1","name":"fields","type":"bytes1"},{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"version","type":"string"},{"internalType":"uint256","name":"chainId","type":"uint256"},{"internalType":"address","name":"verifyingContract","type":"address"},{"internalType":"bytes32","name":"salt","type":"bytes32"},{"internalType":"uint256[]","name":"extensions","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"freezeMetadata","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getDefaultRoyaltyInfo","outputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint16","name":"","type":"uint16"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getPlatformFeeInfo","outputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint16","name":"","type":"uint16"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getRoleMember","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleMemberCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"getRoyaltyInfoForToken","outputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint16","name":"","type":"uint16"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_defaultAdmin","type":"address"},{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_symbol","type":"string"},{"internalType":"string","name":"_contractURI","type":"string"},{"internalType":"address[]","name":"_trustedForwarders","type":"address[]"},{"internalType":"address","name":"_saleRecipient","type":"address"},{"internalType":"address","name":"_royaltyRecipient","type":"address"},{"internalType":"uint128","name":"_royaltyBps","type":"uint128"},{"internalType":"uint128","name":"_platformFeeBps","type":"uint128"},{"internalType":"address","name":"_platformFeeRecipient","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"forwarder","type":"address"}],"name":"isTrustedForwarder","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_to","type":"address"},{"internalType":"string","name":"_uri","type":"string"}],"name":"mintTo","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"to","type":"address"},{"internalType":"address","name":"royaltyRecipient","type":"address"},{"internalType":"uint256","name":"royaltyBps","type":"uint256"},{"internalType":"address","name":"primarySaleRecipient","type":"address"},{"internalType":"string","name":"uri","type":"string"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"address","name":"currency","type":"address"},{"internalType":"uint128","name":"validityStartTimestamp","type":"uint128"},{"internalType":"uint128","name":"validityEndTimestamp","type":"uint128"},{"internalType":"bytes32","name":"uid","type":"bytes32"}],"internalType":"struct ITokenERC721.MintRequest","name":"_req","type":"tuple"},{"internalType":"bytes","name":"_signature","type":"bytes"}],"name":"mintWithSignature","outputs":[{"internalType":"uint256","name":"tokenIdMinted","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"bytes[]","name":"data","type":"bytes[]"}],"name":"multicall","outputs":[{"internalType":"bytes[]","name":"results","type":"bytes[]"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"nextTokenIdToMint","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"platformFeeRecipient","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"primarySaleRecipient","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"salePrice","type":"uint256"}],"name":"royaltyInfo","outputs":[{"internalType":"address","name":"receiver","type":"address"},{"internalType":"uint256","name":"royaltyAmount","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_uri","type":"string"}],"name":"setContractURI","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_royaltyRecipient","type":"address"},{"internalType":"uint256","name":"_royaltyBps","type":"uint256"}],"name":"setDefaultRoyaltyInfo","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_newOwner","type":"address"}],"name":"setOwner","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_platformFeeRecipient","type":"address"},{"internalType":"uint256","name":"_platformFeeBps","type":"uint256"}],"name":"setPlatformFeeInfo","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_saleRecipient","type":"address"}],"name":"setPrimarySaleRecipient","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"},{"internalType":"address","name":"_recipient","type":"address"},{"internalType":"uint256","name":"_bps","type":"uint256"}],"name":"setRoyaltyInfoForToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"},{"internalType":"string","name":"_uri","type":"string"}],"name":"setTokenURI","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"index","type":"uint256"}],"name":"tokenByIndex","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"tokenOfOwnerByIndex","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"uriFrozen","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"to","type":"address"},{"internalType":"address","name":"royaltyRecipient","type":"address"},{"internalType":"uint256","name":"royaltyBps","type":"uint256"},{"internalType":"address","name":"primarySaleRecipient","type":"address"},{"internalType":"string","name":"uri","type":"string"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"address","name":"currency","type":"address"},{"internalType":"uint128","name":"validityStartTimestamp","type":"uint128"},{"internalType":"uint128","name":"validityEndTimestamp","type":"uint128"},{"internalType":"bytes32","name":"uid","type":"bytes32"}],"internalType":"struct ITokenERC721.MintRequest","name":"_req","type":"tuple"},{"internalType":"bytes","name":"_signature","type":"bytes"}],"name":"verify","outputs":[{"internalType":"bool","name":"","type":"bool"},{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}];
  }

  private async initWeb3(): Promise<Web3> {
    if (typeof window !== 'undefined' && window.ethereum) {
      this.web3 = new Web3(window.ethereum);
      return this.web3;
    }
    
    // Fallback to RPC endpoint if MetaMask is not available or having issues
    console.log('🔄 MetaMask not available, using RPC fallback...');
    return this.initWeb3WithRPC();
  }

  private async initWeb3WithRPC(): Promise<Web3> {
    for (const rpcUrl of this.rpcEndpoints) {
      try {
        console.log(`🔗 Trying RPC endpoint: ${rpcUrl}`);
        const web3 = new Web3(rpcUrl);
        
        // Test the connection
        await web3.eth.getBlockNumber();
        console.log(`✅ Successfully connected to: ${rpcUrl}`);
        
        this.web3 = web3;
        return web3;
      } catch (error) {
        console.warn(`⚠️ RPC endpoint failed: ${rpcUrl}`, error);
        continue;
      }
    }
    
    throw new Error('All RPC endpoints failed');
  }

  private async testGatewayReliability(cid: string): Promise<string> {
    for (const gateway of this.ipfsGateways) {
      try {
        const url = `${gateway}${cid}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(url, { 
          method: 'HEAD',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log(`✅ Gateway working: ${gateway}`);
          return url;
        }
      } catch (error) {
        console.warn(`⚠️ Gateway failed: ${gateway}`, error);
        continue;
      }
    }
    // Fallback to first gateway if all fail
    console.warn('⚠️ All gateways failed, using fallback');
    return `${this.ipfsGateways[0]}${cid}`;
  }

  /**
   * Automatically grant MINTER_ROLE to a wallet address
   * Uses AdminMinterService to handle the permission granting
   */
  async grantMinterRoleToWallet(walletAddress: string): Promise<boolean> {
    try {
      console.log('🔑 Checking and granting MINTER_ROLE for wallet:', walletAddress);
      
      // Use AdminMinterService to automatically grant the role
      const result = await adminMinterService.grantMinterRoleToUser(walletAddress);
      
      if (result.success) {
        console.log('✅', result.message);
        if (result.txHash) {
          console.log('📝 Transaction hash:', result.txHash);
        }
        return true;
      } else {
        console.warn('⚠️', result.message);
        return false;
      }

    } catch (error: any) {
      console.error('❌ Failed to grant MINTER_ROLE:', error);
      return false;
    }
  }

  async mintNFT(nftId: string, walletAddress: string): Promise<any> {
    try {
      const web3 = await this.initWeb3();
      
      // Request account access and switch to Polygon Amoy
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Ensure we're on Polygon Amoy testnet
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x13882' }], // Polygon Amoy testnet
        });
      } catch (switchError: any) {
        // If the chain hasn't been added to MetaMask, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x13882',
              chainName: 'Polygon Amoy Testnet',
              nativeCurrency: {
                name: 'MATIC',
                symbol: 'MATIC',
                decimals: 18
              },
              rpcUrls: ['https://rpc-amoy.polygon.technology/'],
              blockExplorerUrls: ['https://amoy.polygonscan.com/']
            }]
          });
        }
      }
      
      // Get NFT data from database
      const { data: nftData, error } = await supabase
        .from('nft_cid_distribution_log')
        .select(`nft_id, rarity, cid, nft_cid_pools!inner(image_url, metadata_cid)`)
        .eq('nft_id', nftId)
        .eq('wallet_address', walletAddress.toLowerCase())
        .single();

      if (error || !nftData) {
        throw new Error(`NFT not found: ${error?.message}`);
      }

      // Get metadata URI with fallback gateways
      const cidPoolData = Array.isArray(nftData.nft_cid_pools) ? nftData.nft_cid_pools[0] : nftData.nft_cid_pools;
      const metadataCID = cidPoolData?.metadata_cid || nftData.cid;
      const metadataURI = await this.testGatewayReliability(metadataCID);

      console.log('🎯 Minting NFT with:', {
        contractAddress: this.contractAddress,
        walletAddress,
        metadataURI,
        nftId
      });

      // Create contract instance
      const contract = new web3.eth.Contract(this.contractABI, this.contractAddress);
      
      // Automatically ensure user has MINTER_ROLE
      console.log('🔑 Ensuring MINTER_ROLE for user...');
      const roleResult = await autoMinterService.ensureMinterRole(walletAddress);
      
      if (!roleResult.success) {
        throw new Error(`Permission setup failed: ${roleResult.message}. Please try again or contact support.`);
      }
      
      if (roleResult.alreadyHadRole) {
        console.log('✅ User already has MINTER_ROLE');
      } else {
        console.log('✅ MINTER_ROLE granted automatically');
        if (roleResult.txHash) {
          console.log('📝 Permission grant transaction:', roleResult.txHash);
        }
      }

      // Check if contract exists at address with retry logic
      let code;
      let contractCheckAttempts = 0;
      const maxContractCheckAttempts = 3;
      
      while (contractCheckAttempts < maxContractCheckAttempts) {
        try {
          code = await web3.eth.getCode(this.contractAddress);
          break;
        } catch (codeError: any) {
          contractCheckAttempts++;
          console.warn(`⚠️ Contract check attempt ${contractCheckAttempts} failed:`, codeError.message);
          
          if (contractCheckAttempts >= maxContractCheckAttempts) {
            // Try with alternative RPC if MetaMask is failing
            console.log('🔄 Trying alternative RPC for contract verification...');
            try {
              const fallbackWeb3 = await this.initWeb3WithRPC();
              code = await fallbackWeb3.eth.getCode(this.contractAddress);
              console.log('✅ Contract verified with alternative RPC');
              break;
            } catch (fallbackError: any) {
              console.error('❌ All contract verification attempts failed');
              throw new Error(`Contract verification failed: ${fallbackError.message}`);
            }
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (code === '0x') {
        throw new Error(`No contract found at address: ${this.contractAddress}`);
      }
      
      // Estimate gas with retry logic
      let gasEstimate;
      let gasAttempts = 0;
      const maxGasAttempts = 3;
      
      while (gasAttempts < maxGasAttempts) {
        try {
          gasEstimate = await contract.methods.mintTo(walletAddress, metadataURI).estimateGas({
            from: walletAddress
          });
          console.log('⛽ Gas estimate:', gasEstimate.toString());
          break;
        } catch (gasError: any) {
          gasAttempts++;
          console.warn(`⚠️ Gas estimation attempt ${gasAttempts} failed:`, gasError.message);
          
          if (gasAttempts >= maxGasAttempts) {
            console.log('🔄 Using default gas limit due to estimation failures');
            gasEstimate = BigInt(400000); // Increased default
            break;
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Get gas price with retry logic
      let gasPrice;
      try {
        gasPrice = await web3.eth.getGasPrice();
      } catch (gasPriceError: any) {
        console.warn('⚠️ Gas price fetch failed, using default:', gasPriceError.message);
        gasPrice = BigInt('30000000000'); // 30 gwei default
      }

      // Send transaction with enhanced error handling
      const tx = await contract.methods.mintTo(walletAddress, metadataURI).send({
        from: walletAddress,
        gas: Math.floor(Number(gasEstimate) * 1.3).toString(), // Increased buffer
        gasPrice: gasPrice.toString()
      });

      console.log('✅ NFT minted successfully:', tx.transactionHash);
      
      // Extract token ID from transaction receipt
      let tokenId = null;
      try {
        const receipt = await web3.eth.getTransactionReceipt(tx.transactionHash);
        if (receipt && receipt.logs && receipt.logs.length > 0) {
          // Look for Transfer event (topic0 = keccak256("Transfer(address,address,uint256)"))
          const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
          const transferLog = receipt.logs.find(log => log.topics && log.topics[0] === transferTopic);
          
          if (transferLog && transferLog.topics && transferLog.topics.length >= 4) {
            // Token ID is the 4th topic (index 3) in Transfer event
            tokenId = parseInt(transferLog.topics[3], 16).toString();
            console.log('🎯 Extracted Token ID:', tokenId);
          }
        }
      } catch (tokenIdError) {
        console.warn('⚠️ Could not extract token ID:', tokenIdError);
      }
      
      // Update database
      await this.updateClaimStatus(nftId, walletAddress, tx.transactionHash, metadataURI, tokenId);
      
      return {
        success: true,
        transactionHash: tx.transactionHash,
        metadataURI,
        tokenId
      };

    } catch (error: any) {
      console.error('❌ Mint failed:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('User denied')) {
        throw new Error('Transaction was cancelled by user');
      } else if (error.message?.includes('insufficient funds')) {
        throw new Error('Insufficient MATIC balance for transaction');
      } else if (error.message?.includes('execution reverted')) {
        throw new Error('Contract execution failed - check if you already own this NFT');
      } else if (error.message?.includes('Internal JSON-RPC error')) {
        throw new Error('Network error - please check your connection and try again');
      }
      
      throw error;
    }
  }

  async transferNFT(tokenId: string, fromAddress: string, toAddress: string): Promise<any> {
    try {
      const web3 = await this.initWeb3();
      
      // Request account access and switch to Polygon Amoy
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Ensure we're on Polygon Amoy testnet
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x13882' }], // Polygon Amoy testnet
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x13882',
              chainName: 'Polygon Amoy Testnet',
              nativeCurrency: {
                name: 'MATIC',
                symbol: 'MATIC',
                decimals: 18
              },
              rpcUrls: ['https://rpc-amoy.polygon.technology/'],
              blockExplorerUrls: ['https://amoy.polygonscan.com/']
            }]
          });
        }
      }

      console.log('🔄 Transferring NFT:', {
        contractAddress: this.contractAddress,
        tokenId,
        fromAddress,
        toAddress
      });

      // Create contract instance
      const contract = new web3.eth.Contract(this.contractABI, this.contractAddress);
      
      // Verify ownership
      const owner = await contract.methods.ownerOf(tokenId).call();
      const ownerAddress = String(owner);
      if (ownerAddress.toLowerCase() !== fromAddress.toLowerCase()) {
        throw new Error(`You don't own this NFT. Owner: ${ownerAddress}`);
      }

      // Estimate gas for transfer
      let gasEstimate;
      try {
        gasEstimate = await contract.methods.safeTransferFrom(fromAddress, toAddress, tokenId).estimateGas({
          from: fromAddress
        });
        console.log('⛽ Transfer gas estimate:', gasEstimate.toString());
      } catch (gasError) {
        console.error('❌ Gas estimation failed:', gasError);
        gasEstimate = BigInt(100000); // Default gas for transfers
      }

      // Execute transfer
      const gasPrice = await web3.eth.getGasPrice();
      const tx = await contract.methods.safeTransferFrom(fromAddress, toAddress, tokenId).send({
        from: fromAddress,
        gas: Math.floor(Number(gasEstimate) * 1.2).toString(),
        gasPrice: gasPrice.toString()
      });

      console.log('✅ NFT transferred successfully:', tx.transactionHash);
      
      return {
        success: true,
        transactionHash: tx.transactionHash,
        tokenId,
        fromAddress,
        toAddress
      };

    } catch (error: any) {
      console.error('❌ Transfer failed:', error);
      
      if (error.message?.includes('User denied')) {
        throw new Error('Transaction was cancelled by user');
      } else if (error.message?.includes('insufficient funds')) {
        throw new Error('Insufficient MATIC balance for transaction');
      } else if (error.message?.includes("You don't own")) {
        throw error;
      } else if (error.message?.includes('execution reverted')) {
        throw new Error('Transfer failed - check if you own this NFT and recipient address is valid');
      }
      
      throw error;
    }
  }

  // ========================================
  // MARKETPLACE FUNCTIONS
  // ========================================

  /**
   * Approve another address to transfer a specific NFT
   * Required for marketplace operations
   */
  async approveNFT(tokenId: string, spenderAddress: string, ownerAddress: string): Promise<any> {
    try {
      const web3 = await this.initWeb3();
      await this.ensureCorrectNetwork();
      
      const contract = new web3.eth.Contract(this.contractABI, this.contractAddress);
      
      // Verify ownership
      const owner = await contract.methods.ownerOf(tokenId).call();
      const ownerStr = String(owner);
      if (ownerStr.toLowerCase() !== ownerAddress.toLowerCase()) {
        throw new Error(`You don't own this NFT. Owner: ${ownerStr}`);
      }

      console.log('✅ Approving NFT:', { tokenId, spenderAddress, ownerAddress });

      // Estimate gas
      const gasEstimate = await contract.methods.approve(spenderAddress, tokenId).estimateGas({
        from: ownerAddress
      });

      // Execute approval
      const gasPrice = await web3.eth.getGasPrice();
      const tx = await contract.methods.approve(spenderAddress, tokenId).send({
        from: ownerAddress,
        gas: Math.floor(Number(gasEstimate) * 1.2).toString(),
        gasPrice: gasPrice.toString()
      });

      console.log('✅ NFT approved successfully:', tx.transactionHash);
      
      return {
        success: true,
        transactionHash: tx.transactionHash,
        tokenId,
        spenderAddress
      };

    } catch (error: any) {
      console.error('❌ Approval failed:', error);
      throw this.handleTransactionError(error);
    }
  }

  /**
   * Set approval for all NFTs to a marketplace contract
   * More efficient for multiple NFT operations
   */
  async setApprovalForAll(operatorAddress: string, approved: boolean, ownerAddress: string): Promise<any> {
    try {
      const web3 = await this.initWeb3();
      await this.ensureCorrectNetwork();
      
      const contract = new web3.eth.Contract(this.contractABI, this.contractAddress);

      console.log('🔄 Setting approval for all:', { operatorAddress, approved, ownerAddress });

      // Estimate gas
      const gasEstimate = await contract.methods.setApprovalForAll(operatorAddress, approved).estimateGas({
        from: ownerAddress
      });

      // Execute approval
      const gasPrice = await web3.eth.getGasPrice();
      const tx = await contract.methods.setApprovalForAll(operatorAddress, approved).send({
        from: ownerAddress,
        gas: Math.floor(Number(gasEstimate) * 1.2).toString(),
        gasPrice: gasPrice.toString()
      });

      console.log('✅ Approval for all set successfully:', tx.transactionHash);
      
      return {
        success: true,
        transactionHash: tx.transactionHash,
        operatorAddress,
        approved
      };

    } catch (error: any) {
      console.error('❌ Set approval for all failed:', error);
      throw this.handleTransactionError(error);
    }
  }

  /**
   * Transfer NFT from one address to another (requires approval)
   * Used by marketplace contracts
   */
  async transferFrom(tokenId: string, fromAddress: string, toAddress: string, senderAddress: string): Promise<any> {
    try {
      const web3 = await this.initWeb3();
      await this.ensureCorrectNetwork();
      
      const contract = new web3.eth.Contract(this.contractABI, this.contractAddress);
      
      // Verify ownership
      const owner = await contract.methods.ownerOf(tokenId).call();
      const ownerStr = String(owner);
      if (ownerStr.toLowerCase() !== fromAddress.toLowerCase()) {
        throw new Error(`Invalid owner. Expected: ${fromAddress}, Actual: ${ownerStr}`);
      }

      // Check approval if sender is not the owner
      if (senderAddress.toLowerCase() !== fromAddress.toLowerCase()) {
        const approved = await contract.methods.getApproved(tokenId).call();
        const isApprovedForAll = await contract.methods.isApprovedForAll(fromAddress, senderAddress).call();
        const approvedStr = String(approved);
        const isApprovedBool = Boolean(isApprovedForAll);
        
        if (approvedStr.toLowerCase() !== senderAddress.toLowerCase() && !isApprovedBool) {
          throw new Error('Not approved to transfer this NFT');
        }
      }

      console.log('🔄 Transferring NFT via transferFrom:', {
        tokenId, fromAddress, toAddress, senderAddress
      });

      // Estimate gas
      const gasEstimate = await contract.methods.transferFrom(fromAddress, toAddress, tokenId).estimateGas({
        from: senderAddress
      });

      // Execute transfer
      const gasPrice = await web3.eth.getGasPrice();
      const tx = await contract.methods.transferFrom(fromAddress, toAddress, tokenId).send({
        from: senderAddress,
        gas: Math.floor(Number(gasEstimate) * 1.2).toString(),
        gasPrice: gasPrice.toString()
      });

      console.log('✅ NFT transferred via transferFrom successfully:', tx.transactionHash);
      
      return {
        success: true,
        transactionHash: tx.transactionHash,
        tokenId,
        fromAddress,
        toAddress
      };

    } catch (error: any) {
      console.error('❌ TransferFrom failed:', error);
      throw this.handleTransactionError(error);
    }
  }

  // ========================================
  // MARKETPLACE UTILITY FUNCTIONS
  // ========================================

  /**
   * Get the approved address for a specific NFT
   */
  async getApproved(tokenId: string): Promise<string> {
    try {
      const web3 = await this.initWeb3();
      const contract = new web3.eth.Contract(this.contractABI, this.contractAddress);
      
      const approved = await contract.methods.getApproved(tokenId).call();
      return String(approved);
    } catch (error) {
      console.error('❌ Get approved failed:', error);
      throw error;
    }
  }

  /**
   * Check if an operator is approved for all NFTs of an owner
   */
  async isApprovedForAll(ownerAddress: string, operatorAddress: string): Promise<boolean> {
    try {
      const web3 = await this.initWeb3();
      const contract = new web3.eth.Contract(this.contractABI, this.contractAddress);
      
      const isApproved = await contract.methods.isApprovedForAll(ownerAddress, operatorAddress).call();
      return Boolean(isApproved);
    } catch (error) {
      console.error('❌ Is approved for all failed:', error);
      throw error;
    }
  }

  /**
   * Get the owner of a specific NFT
   */
  async getOwnerOf(tokenId: string): Promise<string> {
    try {
      const web3 = await this.initWeb3();
      const contract = new web3.eth.Contract(this.contractABI, this.contractAddress);
      
      const owner = await contract.methods.ownerOf(tokenId).call();
      return String(owner);
    } catch (error) {
      console.error('❌ Get owner failed:', error);
      throw error;
    }
  }

  /**
   * Get the token URI (metadata) for a specific NFT
   */
  async getTokenURI(tokenId: string): Promise<string> {
    try {
      const web3 = await this.initWeb3();
      const contract = new web3.eth.Contract(this.contractABI, this.contractAddress);
      
      const tokenURI = await contract.methods.tokenURI(tokenId).call();
      return String(tokenURI);
    } catch (error) {
      console.error('❌ Get token URI failed:', error);
      throw error;
    }
  }

  /**
   * Get the total supply of NFTs
   */
  async getTotalSupply(): Promise<number> {
    try {
      const web3 = await this.initWeb3();
      const contract = new web3.eth.Contract(this.contractABI, this.contractAddress);
      
      const totalSupply = await contract.methods.totalSupply().call();
      return parseInt(String(totalSupply));
    } catch (error) {
      console.error('❌ Get total supply failed:', error);
      throw error;
    }
  }

  /**
   * Get NFT balance of an address
   */
  async getBalanceOf(ownerAddress: string): Promise<number> {
    try {
      const web3 = await this.initWeb3();
      const contract = new web3.eth.Contract(this.contractABI, this.contractAddress);
      
      const balance = await contract.methods.balanceOf(ownerAddress).call();
      return parseInt(String(balance));
    } catch (error) {
      console.error('❌ Get balance failed:', error);
      throw error;
    }
  }

  /**
   * Get all NFT token IDs owned by a wallet address
   * Uses tokenOfOwnerByIndex(owner, index) function directly
   */
  async getOwnedTokenIds(ownerAddress: string): Promise<string[]> {
    try {
      console.log(`🔍 Using tokenOfOwnerByIndex to fetch NFTs for: ${ownerAddress}`);
      
      // Try with MetaMask first, then fallback to RPC
      let web3: Web3;
      try {
        web3 = await this.initWeb3();
      } catch (error) {
        console.log('🔄 MetaMask failed, using RPC fallback for token query...');
        web3 = await this.initWeb3WithRPC();
      }
      
      const contract = new web3.eth.Contract(this.contractABI, this.contractAddress);
      
      // Get the balance first - this tells us how many NFTs the owner has
      const balance = await contract.methods.balanceOf(ownerAddress).call();
      const balanceNum = parseInt(String(balance));
      
      console.log(`🔍 Wallet ${ownerAddress} owns ${balanceNum} NFTs`);
      
      if (balanceNum === 0) {
        return [];
      }

      const tokenIds: string[] = [];
      
      // Use tokenOfOwnerByIndex(owner, index) to get each token ID
      for (let index = 0; index < balanceNum; index++) {
        try {
          console.log(`🔍 Fetching token at index ${index} for owner ${ownerAddress}`);
          const tokenId = await contract.methods.tokenOfOwnerByIndex(ownerAddress, index).call();
          const tokenIdStr = String(tokenId);
          tokenIds.push(tokenIdStr);
          console.log(`✅ Found token ID: ${tokenIdStr} at index ${index}`);
        } catch (error) {
          console.warn(`⚠️ Failed to get token at index ${index}:`, error);
          // Continue with other tokens instead of breaking
        }
      }
      
      console.log(`✅ Successfully fetched ${tokenIds.length} token IDs using tokenOfOwnerByIndex:`, tokenIds);
      return tokenIds;
    } catch (error) {
      console.error('❌ tokenOfOwnerByIndex query failed:', error);
      throw error;
    }
  }

  /**
   * Get complete NFT data for all tokens owned by a wallet
   * Returns array of objects with tokenId, tokenURI, and metadata
   */
  async getOwnedNFTs(ownerAddress: string): Promise<Array<{
    tokenId: string;
    tokenURI: string;
    metadata?: any;
    owner: string;
  }>> {
    try {
      console.log(`🔍 Loading all NFTs for wallet: ${ownerAddress}`);
      
      // Get all token IDs owned by the wallet
      const tokenIds = await this.getOwnedTokenIds(ownerAddress);
      
      if (tokenIds.length === 0) {
        console.log('📭 No NFTs found for this wallet');
        return [];
      }

      const nfts: Array<{
        tokenId: string;
        tokenURI: string;
        metadata?: any;
        owner: string;
      }> = [];

      // Get metadata for each token
      for (const tokenId of tokenIds) {
        try {
          const tokenURI = await this.getTokenURI(tokenId);
          const owner = await this.getOwnerOf(tokenId);
          
          let metadata = null;
          
          // Try to fetch metadata from tokenURI
          if (tokenURI) {
            try {
              let metadataUrl = tokenURI;
              
              // Convert IPFS URLs to reliable gateway URLs
              if (tokenURI.startsWith('ipfs://')) {
                const ipfsHash = tokenURI.replace('ipfs://', '');
                metadataUrl = await this.testGatewayReliability(ipfsHash);
              } else if (tokenURI.includes('ipfs') && tokenURI.includes('Qm')) {
                // Extract IPFS hash from existing gateway URL and test reliability
                const ipfsMatch = tokenURI.match(/Qm[1-9A-HJ-NP-Za-km-z]{44}/);
                if (ipfsMatch) {
                  metadataUrl = await this.testGatewayReliability(ipfsMatch[0]);
                }
              }
              
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000);
              
              const response = await fetch(metadataUrl, {
                signal: controller.signal,
                headers: {
                  'Accept': 'application/json',
                }
              });
              
              clearTimeout(timeoutId);
              
              if (response.ok) {
                metadata = await response.json();
                console.log(`✅ Successfully fetched metadata for token ${tokenId}`);
                
                // If metadata has an image, also test its reliability
                if (metadata && metadata.image) {
                  if (metadata.image.startsWith('ipfs://')) {
                    const imageHash = metadata.image.replace('ipfs://', '');
                    metadata.image = await this.testGatewayReliability(imageHash);
                  } else if (metadata.image.includes('ipfs') && metadata.image.includes('Qm')) {
                    const imageMatch = metadata.image.match(/Qm[1-9A-HJ-NP-Za-km-z]{44}/);
                    if (imageMatch) {
                      metadata.image = await this.testGatewayReliability(imageMatch[0]);
                    }
                  }
                }
              }
            } catch (metadataError) {
              console.warn(`⚠️ Failed to fetch metadata for token ${tokenId}:`, metadataError);
            }
          }

          nfts.push({
            tokenId,
            tokenURI,
            metadata,
            owner
          });
          
        } catch (error) {
          console.warn(`⚠️ Failed to get data for token ${tokenId}:`, error);
          // Continue with other tokens
        }
      }

      console.log(`✅ Successfully loaded ${nfts.length} NFTs from blockchain`);
      return nfts;
      
    } catch (error) {
      console.error('❌ Get owned NFTs failed:', error);
      throw error;
    }
  }

  // ========================================
  // MARKETPLACE INTEGRATION FUNCTIONS
  // ========================================

  /**
   * Complete marketplace purchase flow
   * 1. Verify ownership and approval
   * 2. Execute transfer
   * 3. Update database records
   */
  async executePurchase(
    tokenId: string,
    sellerAddress: string,
    buyerAddress: string,
    priceInMatic: string,
    marketplaceAddress?: string
  ): Promise<any> {
    try {
      console.log('🛒 Executing purchase:', {
        tokenId, sellerAddress, buyerAddress, priceInMatic, marketplaceAddress
      });

      // Verify ownership
      const owner = await this.getOwnerOf(tokenId);
      if (owner.toLowerCase() !== sellerAddress.toLowerCase()) {
        throw new Error(`Seller doesn't own this NFT. Owner: ${owner}`);
      }

      // If using marketplace contract, check approval
      if (marketplaceAddress) {
        const isApproved = await this.isApprovedForAll(sellerAddress, marketplaceAddress);
        const specificApproval = await this.getApproved(tokenId);
        
        if (!isApproved && specificApproval.toLowerCase() !== marketplaceAddress.toLowerCase()) {
          throw new Error('NFT not approved for marketplace. Please approve first.');
        }

        // Execute transfer through marketplace
        return await this.transferFrom(tokenId, sellerAddress, buyerAddress, marketplaceAddress);
      } else {
        // Direct transfer (seller must initiate)
        return await this.transferNFT(tokenId, sellerAddress, buyerAddress);
      }

    } catch (error: any) {
      console.error('❌ Purchase execution failed:', error);
      throw error;
    }
  }

  /**
   * List NFT for sale (approve marketplace)
   */
  async listForSale(
    tokenId: string,
    ownerAddress: string,
    marketplaceAddress: string,
    priceInMatic: string
  ): Promise<any> {
    try {
      console.log('📝 Listing NFT for sale:', {
        tokenId, ownerAddress, marketplaceAddress, priceInMatic
      });

      // Approve marketplace to transfer the NFT
      const approvalResult = await this.approveNFT(tokenId, marketplaceAddress, ownerAddress);
      
      // Here you would typically call your marketplace contract's listing function
      // For now, we'll just return the approval result
      return {
        ...approvalResult,
        listed: true,
        price: priceInMatic
      };

    } catch (error: any) {
      console.error('❌ Listing failed:', error);
      throw error;
    }
  }

  // ========================================
  // HELPER FUNCTIONS
  // ========================================

  private async ensureCorrectNetwork(): Promise<void> {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x13882' }], // Polygon Amoy testnet
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x13882',
            chainName: 'Polygon Amoy Testnet',
            nativeCurrency: {
              name: 'MATIC',
              symbol: 'MATIC',
              decimals: 18
            },
            rpcUrls: ['https://rpc-amoy.polygon.technology/'],
            blockExplorerUrls: ['https://amoy.polygonscan.com/']
          }]
        });
      }
    }
  }

  private handleTransactionError(error: any): Error {
    if (error.message?.includes('User denied')) {
      return new Error('Transaction was cancelled by user');
    } else if (error.message?.includes('insufficient funds')) {
      return new Error('Insufficient MATIC balance for transaction');
    } else if (error.message?.includes('execution reverted')) {
      return new Error('Transaction failed - please check the conditions and try again');
    } else if (error.message?.includes('Internal JSON-RPC error')) {
      return new Error('Network error - please check your connection and try again');
    }
    return error;
  }

  async debugNFTOwnership(tokenId: string): Promise<void> {
    try {
      const web3 = await this.initWeb3();
      const contract = new web3.eth.Contract(this.contractABI, this.contractAddress);
      
      const accounts = await web3.eth.getAccounts();
      console.log('🔍 Available accounts:', accounts);
      
      const owner = await contract.methods.ownerOf(tokenId).call();
      console.log(`🎯 Token ${tokenId} owner:`, owner);
      
      const tokenURI = await contract.methods.tokenURI(tokenId).call();
      console.log(`📋 Token ${tokenId} URI:`, tokenURI);
      
    } catch (error) {
      console.error('❌ Debug failed:', error);
    }
  }

  private async updateClaimStatus(nftId: string, walletAddress: string, txHash: string, metadataURI: string, tokenId?: string | null): Promise<void> {
    try {
      const claimData: any = {
        nft_id: nftId,
        wallet_address: walletAddress.toLowerCase(),
        transaction_hash: txHash,
        claimed_at: new Date().toISOString(),
        contract_address: this.contractAddress,
        claimed_blockchain: 'polygon',
        metadata_uri: metadataURI
      };

      // Add token ID if available
      if (tokenId) {
        claimData.token_id = tokenId;
      }

      await supabase.from('nft_claims').insert(claimData);
      console.log('✅ Database updated', tokenId ? `with Token ID: ${tokenId}` : '');
    } catch (error) {
      console.error('❌ Database update failed:', error);
    }
  }
}

export const web3MetaMaskNFTService = new Web3MetaMaskNFTService();
