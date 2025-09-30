import * as ethers from 'ethers';
import { supabase } from '../lib/supabase';

/**
 * Simple MetaMask NFT Service - Uses existing metadata with gateway testing
 * This is a simplified version that just adds MetaMask compatibility to existing data
 */
export class SimpleMetaMaskNFTService {
  private rpcEndpoints: string[];
  private contractABI: any[];
  private contractAddress: string;
  private ipfsGateways: string[];

  constructor() {
    this.contractAddress = import.meta.env.NFT_CLAIM_CONTRACT_ADDRESS || "0x5Bb23220cC12585264fCd144C448eF222c8572A2";
    
    this.rpcEndpoints = [
      'https://rpc-amoy.polygon.technology/',
      'https://polygon-amoy.g.alchemy.com/v2/demo',
      'https://polygon-amoy.drpc.org',
      'https://polygon-amoy-bor-rpc.publicnode.com',
      'https://rpc.ankr.com/polygon_amoy',
      'https://polygon-amoy.blockpi.network/v1/rpc/public',
      'https://endpoints.omniatech.io/v1/matic/amoy/public'
    ];

    // IPFS gateways prioritizing Pinata (your data source)
    this.ipfsGateways = [
      'https://gateway.pinata.cloud/ipfs/',
      'https://ipfs.io/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://dweb.link/ipfs/'
    ];

    this.contractABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"CurrencyTransferLibFailedNativeTransfer","type":"error"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"NFTMetadataFrozen","type":"error"},{"inputs":[],"name":"NFTMetadataInvalidUrl","type":"error"},{"inputs":[],"name":"NFTMetadataUnauthorized","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"_fromTokenId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"_toTokenId","type":"uint256"}],"name":"BatchMetadataUpdate","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newRoyaltyRecipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"newRoyaltyBps","type":"uint256"}],"name":"DefaultRoyalty","type":"event"},{"anonymous":false,"inputs":[],"name":"EIP712DomainChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"platformFeeRecipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"flatFee","type":"uint256"}],"name":"FlatPlatformFeeUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"version","type":"uint8"}],"name":"Initialized","type":"event"},{"anonymous":false,"inputs":[],"name":"MetadataFrozen","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"MetadataUpdate","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"prevOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnerUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"platformFeeRecipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"platformFeeBps","type":"uint256"}],"name":"PlatformFeeInfoUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"enum IPlatformFee.PlatformFeeType","name":"feeType","type":"uint8"}],"name":"PlatformFeeTypeUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"recipient","type":"address"}],"name":"PrimarySaleRecipientUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"royaltyRecipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"royaltyBps","type":"uint256"}],"name":"RoyaltyForToken","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"mintedTo","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenIdMinted","type":"uint256"},{"indexed":false,"internalType":"string","name":"uri","type":"string"}],"name":"TokensMinted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"signer","type":"address"},{"indexed":true,"internalType":"address","name":"mintedTo","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenIdMinted","type":"uint256"},{"components":[{"internalType":"address","name":"to","type":"address"},{"internalType":"address","name":"royaltyRecipient","type":"address"},{"internalType":"uint256","name":"royaltyBps","type":"uint256"},{"internalType":"address","name":"primarySaleRecipient","type":"address"},{"internalType":"string","name":"uri","type":"string"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"address","name":"currency","type":"address"},{"internalType":"uint128","name":"validityStartTimestamp","type":"uint128"},{"internalType":"uint128","name":"validityEndTimestamp","type":"uint128"},{"internalType":"bytes32","name":"uid","type":"bytes32"}],"indexed":false,"internalType":"struct ITokenERC721.MintRequest","name":"mintRequest","type":"tuple"}],"name":"TokensMintedWithSignature","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEFAULT_FEE_RECIPIENT","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"burn","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"contractType","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"contractURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"contractVersion","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"eip712Domain","outputs":[{"internalType":"bytes1","name":"fields","type":"bytes1"},{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"version","type":"string"},{"internalType":"uint256","name":"chainId","type":"uint256"},{"internalType":"address","name":"verifyingContract","type":"address"},{"internalType":"bytes32","name":"salt","type":"bytes32"},{"internalType":"uint256[]","name":"extensions","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"freezeMetadata","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getDefaultRoyaltyInfo","outputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint16","name":"","type":"uint16"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getPlatformFeeInfo","outputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint16","name":"","type":"uint16"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getRoleMember","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleMemberCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"getRoyaltyInfoForToken","outputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint16","name":"","type":"uint16"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_defaultAdmin","type":"address"},{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_symbol","type":"string"},{"internalType":"string","name":"_contractURI","type":"string"},{"internalType":"address[]","name":"_trustedForwarders","type":"address[]"},{"internalType":"address","name":"_saleRecipient","type":"address"},{"internalType":"address","name":"_royaltyRecipient","type":"address"},{"internalType":"uint128","name":"_royaltyBps","type":"uint128"},{"internalType":"uint128","name":"_platformFeeBps","type":"uint128"},{"internalType":"address","name":"_platformFeeRecipient","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"forwarder","type":"address"}],"name":"isTrustedForwarder","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_to","type":"address"},{"internalType":"string","name":"_uri","type":"string"}],"name":"mintTo","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"to","type":"address"},{"internalType":"address","name":"royaltyRecipient","type":"address"},{"internalType":"uint256","name":"royaltyBps","type":"uint256"},{"internalType":"address","name":"primarySaleRecipient","type":"address"},{"internalType":"string","name":"uri","type":"string"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"address","name":"currency","type":"address"},{"internalType":"uint128","name":"validityStartTimestamp","type":"uint128"},{"internalType":"uint128","name":"validityEndTimestamp","type":"uint128"},{"internalType":"bytes32","name":"uid","type":"bytes32"}],"internalType":"struct ITokenERC721.MintRequest","name":"_req","type":"tuple"},{"internalType":"bytes","name":"_signature","type":"bytes"}],"name":"mintWithSignature","outputs":[{"internalType":"uint256","name":"tokenIdMinted","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"bytes[]","name":"data","type":"bytes[]"}],"name":"multicall","outputs":[{"internalType":"bytes[]","name":"results","type":"bytes[]"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"nextTokenIdToMint","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"platformFeeRecipient","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"primarySaleRecipient","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"salePrice","type":"uint256"}],"name":"royaltyInfo","outputs":[{"internalType":"address","name":"receiver","type":"address"},{"internalType":"uint256","name":"royaltyAmount","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_uri","type":"string"}],"name":"setContractURI","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_royaltyRecipient","type":"address"},{"internalType":"uint256","name":"_royaltyBps","type":"uint256"}],"name":"setDefaultRoyaltyInfo","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_newOwner","type":"address"}],"name":"setOwner","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_platformFeeRecipient","type":"address"},{"internalType":"uint256","name":"_platformFeeBps","type":"uint256"}],"name":"setPlatformFeeInfo","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_saleRecipient","type":"address"}],"name":"setPrimarySaleRecipient","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"},{"internalType":"address","name":"_recipient","type":"address"},{"internalType":"uint256","name":"_bps","type":"uint256"}],"name":"setRoyaltyInfoForToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"},{"internalType":"string","name":"_uri","type":"string"}],"name":"setTokenURI","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"index","type":"uint256"}],"name":"tokenByIndex","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"tokenOfOwnerByIndex","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"uriFrozen","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"to","type":"address"},{"internalType":"address","name":"royaltyRecipient","type":"address"},{"internalType":"uint256","name":"royaltyBps","type":"uint256"},{"internalType":"address","name":"primarySaleRecipient","type":"address"},{"internalType":"string","name":"uri","type":"string"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"address","name":"currency","type":"address"},{"internalType":"uint128","name":"validityStartTimestamp","type":"uint128"},{"internalType":"uint128","name":"validityEndTimestamp","type":"uint128"},{"internalType":"bytes32","name":"uid","type":"bytes32"}],"internalType":"struct ITokenERC721.MintRequest","name":"_req","type":"tuple"},{"internalType":"bytes","name":"_signature","type":"bytes"}],"name":"verify","outputs":[{"internalType":"bool","name":"","type":"bool"},{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}];
  }

  /**
   * Add NFT to MetaMask wallet
   */
  private async addNFTToMetaMask(tokenId: string, metadataURI: string): Promise<void> {
    if (!window.ethereum) {
      throw new Error("MetaMask not available");
    }

    try {
      // Fetch metadata to get NFT name and image
      const metadataResponse = await fetch(metadataURI);
      const metadata = await metadataResponse.json();

      console.log(`🎨 Adding NFT to MetaMask: Token ${tokenId}`);
      
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC721',
          options: {
            address: this.contractAddress,
            tokenId: tokenId,
            name: metadata.name || `NEFTIT NFT #${tokenId}`,
            description: metadata.description || 'NEFTIT Platform NFT',
            image: metadata.image || '',
          },
        },
      } as any);

      console.log(`✅ NFT added to MetaMask successfully`);
    } catch (error) {
      console.error(`❌ Failed to add NFT to MetaMask:`, error);
      throw error;
    }
  }

  /**
   * Debug NFT transfer issues - comprehensive check with RPC failover
   */
  public async debugNFTTransferIssues(tokenId: string): Promise<void> {
    if (!window.ethereum) {
      throw new Error("MetaMask not available");
    }

    try {
      // Get current account first
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      const currentAccount = accounts[0];
      console.log(`🔍 Current account: ${currentAccount}`);

      // Try multiple RPC endpoints to handle sync issues
      let tokenExists = false;
      let actualOwner = "";
      let tokenURI = "";
      let workingProvider: ethers.providers.JsonRpcProvider | null = null;

      console.log(`🔍 Checking if token ${tokenId} exists on blockchain (trying multiple RPC endpoints)...`);
      
      for (const rpcUrl of this.rpcEndpoints) {
        try {
          console.log(`🌐 Trying RPC: ${rpcUrl}`);
          const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
          const contract = new ethers.Contract(this.contractAddress, this.contractABI, provider);
          
          // Test the RPC endpoint with ownerOf call
          actualOwner = await contract.ownerOf(tokenId);
          tokenExists = true;
          workingProvider = provider;
          
          console.log(`✅ Token ${tokenId} exists on blockchain (via ${rpcUrl})`);
          console.log(`🎯 Token ${tokenId} actual owner: ${actualOwner}`);
          console.log(`${currentAccount.toLowerCase() === actualOwner.toLowerCase() ? '✅' : '❌'} Current account is owner: ${currentAccount.toLowerCase() === actualOwner.toLowerCase()}`);
          break;
          
        } catch (error: any) {
          console.log(`❌ RPC ${rpcUrl} failed:`, error.message.substring(0, 100) + "...");
          
          if (error.message.includes("missing trie node") || error.message.includes("Internal JSON-RPC error")) {
            console.log(`🔄 RPC sync issue detected, trying next endpoint...`);
            continue;
          } else if (error.message.includes("ERC721: invalid token ID") || error.message.includes("nonexistent token")) {
            console.log(`🚫 Token ${tokenId} confirmed non-existent on this RPC`);
            break;
          }
        }
      }
      
      if (!tokenExists) {
        console.log(`❌ Token ${tokenId} not found on any RPC endpoint`);
        // Check if token exists in database but not on blockchain
        await this.checkDatabaseVsBlockchain(tokenId, currentAccount);
        return;
      }

      // Use the working provider for remaining checks
      const provider = workingProvider || new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(this.contractAddress, this.contractABI, provider);
      
      // Check network and gas
      try {
        const network = await provider.getNetwork();
        console.log(`🌐 Network: ${network.name} (${network.chainId})`);
        
        const gasPrice = await provider.getGasPrice();
        console.log(`⛽ Current gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
      } catch (error) {
        console.log(`⚠️ Could not get network info:`, error);
      }
      
      // If token exists, continue with full debug
      try {
        tokenURI = await contract.tokenURI(tokenId);
        console.log(`📋 Token ${tokenId} URI: ${tokenURI}`);
      } catch (error) {
        console.log(`⚠️ Could not get token URI:`, error);
      }
      
      // Check contract approval status
      try {
        const approved = await contract.getApproved(tokenId);
        console.log(`🔐 Token ${tokenId} approved address: ${approved}`);
        
        const isApprovedForAll = await contract.isApprovedForAll(actualOwner, currentAccount);
        console.log(`🔓 Is approved for all: ${isApprovedForAll}`);
      } catch (error) {
        console.log(`⚠️ Could not check approval status:`, error);
      }
      
      // Check if contract is paused or has transfer restrictions
      try {
        const contractOwner = await contract.owner();
        console.log(`👑 Contract owner: ${contractOwner}`);
        
        const uriFrozen = await contract.uriFrozen();
        console.log(`🧊 URI frozen: ${uriFrozen}`);
      } catch (error: any) {
        console.log(`ℹ️ Contract owner/freeze check not available:`, error.message);
      }
      
      // Test if we can estimate gas for a transfer (without executing)
      if (actualOwner && currentAccount.toLowerCase() === actualOwner.toLowerCase()) {
        try {
          const testRecipient = "0x0000000000000000000000000000000000000001"; // Burn address for testing
          const gasEstimate = await contract.estimateGas.transferFrom(actualOwner, testRecipient, tokenId);
          console.log(`💨 Transfer gas estimate: ${gasEstimate.toString()}`);
          console.log(`✅ Transfer should work - no restrictions detected`);
        } catch (error: any) {
          console.log(`❌ Transfer would fail:`, error.message);
          
          // Check specific error reasons
          if (error.message.includes("ERC721: caller is not token owner or approved")) {
            console.log(`🚫 Issue: Not approved to transfer this token`);
          } else if (error.message.includes("ERC721: transfer from incorrect owner")) {
            console.log(`🚫 Issue: Trying to transfer from wrong owner`);
          } else if (error.message.includes("ERC721: transfer to non ERC721Receiver implementer")) {
            console.log(`🚫 Issue: Recipient cannot receive NFTs`);
          }
        }
      } else {
        console.log(`⚠️ Cannot test transfer - you don't own this token`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to debug NFT transfer issues:`, error);
    }
  }

  /**
   * Check if NFT exists in database but not on blockchain
   */
  private async checkDatabaseVsBlockchain(tokenId: string, walletAddress: string): Promise<void> {
    try {
      console.log(`🔍 Checking database for token ${tokenId}...`);
      
      // Check if NFT exists in distribution log
      const { data: nftData, error } = await supabase
        .from('nft_cid_distribution_log')
        .select(`
          nft_id,
          rarity,
          cid,
          distributed_at,
          wallet_address,
          nft_cid_pools!inner(
            image_url,
            metadata_cid
          )
        `)
        .eq('nft_id', tokenId)
        .eq('wallet_address', walletAddress.toLowerCase());

      if (error) {
        console.log(`❌ Database error:`, error);
        return;
      }

      if (nftData && nftData.length > 0) {
        console.log(`✅ Token ${tokenId} found in database for wallet ${walletAddress}`);
        console.log(`📊 NFT data:`, nftData[0]);
        
        // Check if it's been claimed/minted
        const { data: claimData } = await supabase
          .from('nft_claims')
          .select('*')
          .eq('nft_id', tokenId)
          .eq('wallet_address', walletAddress.toLowerCase());

        if (claimData && claimData.length > 0) {
          console.log(`📋 Claim record found:`, claimData[0]);
          console.log(`🚫 This NFT was supposedly minted but doesn't exist on blockchain`);
          console.log(`💡 Possible issues:`);
          console.log(`   - Transaction failed but database was updated`);
          console.log(`   - Wrong network or contract address`);
          console.log(`   - RPC node sync issues`);
        } else {
          console.log(`⏳ NFT exists in database but hasn't been claimed/minted yet`);
          console.log(`💡 You can mint this NFT using the claim function`);
        }
      } else {
        console.log(`❌ Token ${tokenId} not found in database for wallet ${walletAddress}`);
        console.log(`💡 This token ID may not be assigned to your wallet`);
      }
    } catch (error) {
      console.error(`❌ Error checking database:`, error);
    }
  }

  /**
   * Debug NFT ownership across multiple accounts
   */
  public async debugNFTOwnership(tokenId: string): Promise<void> {
    if (!window.ethereum) {
      throw new Error("MetaMask not available");
    }

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(this.contractAddress, this.contractABI, provider);
      
      // Get all accounts
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      console.log(`🔍 Available accounts:`, accounts);
      
      // Check actual on-chain owner
      const actualOwner = await contract.ownerOf(tokenId);
      console.log(`🎯 Token ${tokenId} actual owner on blockchain: ${actualOwner}`);
      
      // Check which account actually owns it
      for (const account of accounts) {
        const balance = await contract.balanceOf(account);
        console.log(`💰 Account ${account} balance: ${balance.toString()} NFTs`);
        
        if (account.toLowerCase() === actualOwner.toLowerCase()) {
          console.log(`✅ Account ${account} is the actual owner`);
        } else {
          console.log(`❌ Account ${account} is NOT the owner but may show NFT in MetaMask watch list`);
        }
      }
      
      // Check token URI
      const tokenURI = await contract.tokenURI(tokenId);
      console.log(`📋 Token ${tokenId} URI: ${tokenURI}`);
      
    } catch (error) {
      console.error(`❌ Failed to debug NFT ownership:`, error);
    }
  }

  /**
   * Verify NFT ownership before adding to MetaMask
   */
  public async verifyNFTOwnership(tokenId: string, expectedOwner: string): Promise<boolean> {
    if (!window.ethereum) {
      throw new Error("MetaMask not available");
    }

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(this.contractAddress, [
        {
          "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
          "name": "ownerOf",
          "outputs": [{"internalType": "address", "name": "", "type": "address"}],
          "stateMutability": "view",
          "type": "function"
        }
      ], provider);
      
      const actualOwner = await contract.ownerOf(tokenId);
      console.log(`🔍 Token ${tokenId} owner: ${actualOwner}`);
      console.log(`🎯 Expected owner: ${expectedOwner}`);
      
      return actualOwner.toLowerCase() === expectedOwner.toLowerCase();
    } catch (error) {
      console.error(`❌ Failed to verify NFT ownership:`, error);
      return false;
    }
  }

  /**
   * Manually add an existing NFT to MetaMask wallet
   */
  public async addExistingNFTToMetaMask(tokenId: string): Promise<void> {
    if (!window.ethereum) {
      throw new Error("MetaMask not available");
    }

    try {
      // Connect to the contract to get token URI
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(this.contractAddress, this.contractABI, provider);
      
      const tokenURI = await contract.tokenURI(tokenId);
      console.log(`🔍 Retrieved token URI for ${tokenId}: ${tokenURI}`);
      
      await this.addNFTToMetaMask(tokenId, tokenURI);
    } catch (error) {
      console.error(`❌ Failed to add existing NFT to MetaMask:`, error);
      throw error;
    }
  }

  /**
   * Test IPFS gateways to find working one for metadata
   */
  private async findWorkingMetadataURL(metadataCID: string): Promise<string> {
    console.log(`🔍 Testing IPFS gateways for metadata: ${metadataCID}`);
    
    for (const gateway of this.ipfsGateways) {
      try {
        const metadataURL = `${gateway}${metadataCID}`;
        const response = await fetch(metadataURL, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
        
        if (response.ok) {
          console.log(`✅ Working metadata gateway: ${gateway}`);
          return metadataURL;
        }
      } catch (error) {
        console.log(`❌ Gateway failed: ${gateway}`);
        continue;
      }
    }
    
    // Fallback to Pinata (your primary gateway)
    const fallbackURL = `https://gateway.pinata.cloud/ipfs/${metadataCID}`;
    console.log(`⚠️ Using Pinata fallback: ${fallbackURL}`);
    return fallbackURL;
  }

  /**
   * Mint NFT using existing metadata with gateway testing
   */
  async mintNFT(nftId: string, walletAddress: string): Promise<any> {
    console.log(`🎯 Starting simple MetaMask NFT mint for ${nftId}`);

    try {
      // Get existing NFT data (same as NFTCollectionMintService)
      const { data: nftData, error } = await supabase
        .from('nft_cid_distribution_log')
        .select(`
          nft_id,
          rarity,
          cid,
          distributed_at,
          nft_cid_pools!inner(
            image_url,
            metadata_cid
          )
        `)
        .eq('nft_id', nftId)
        .eq('wallet_address', walletAddress.toLowerCase())
        .single();

      if (error || !nftData) {
        throw new Error(`NFT not found: ${error?.message}`);
      }

      // Get metadata CID (same logic as original)
      const cidPoolData = Array.isArray(nftData.nft_cid_pools) ? nftData.nft_cid_pools[0] : nftData.nft_cid_pools;
      let metadataCID = "";
      
      if (cidPoolData?.metadata_cid) {
        metadataCID = cidPoolData.metadata_cid;
      } else if (nftData.cid) {
        metadataCID = nftData.cid;
      } else {
        throw new Error('No metadata CID found');
      }

      // Find working gateway for metadata (NEW - this is the key improvement)
      const metadataURI = await this.findWorkingMetadataURL(metadataCID);
      console.log(`📋 Tested metadata URI: ${metadataURI}`);

      // Mint with working metadata URI
      for (const rpcUrl of this.rpcEndpoints) {
        try {
          const result = await this.attemptMintWithRPC(rpcUrl, walletAddress, metadataURI);
          if (result.success) {
            console.log(`✅ Simple MetaMask mint successful with RPC: ${rpcUrl}`);
            
            // Update database
            await this.updateNFTClaimStatus(nftId, walletAddress, result.tokenId, result.transactionHash, metadataURI);
            
            return result;
          }
        } catch (error: any) {
          console.log(`❌ RPC ${rpcUrl} failed:`, error.message);
          continue;
        }
      }

      throw new Error("All RPC endpoints failed");

    } catch (error: any) {
      console.error("❌ Simple MetaMask mint failed:", error);
      throw error;
    }
  }

  private async attemptMintWithRPC(rpcUrl: string, walletAddress: string, metadataURI: string): Promise<any> {
    console.log(`🔗 Attempting mint with RPC: ${rpcUrl}`);
    
    if (!window.ethereum) {
      throw new Error("MetaMask not found");
    }

    // Request account access first
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      console.log(`🔍 Available accounts:`, accounts);
    } catch (error) {
      throw new Error("User denied account access");
    }

    // Create Web3Provider directly from MetaMask
    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
    
    // Ensure correct network first
    const network = await web3Provider.getNetwork();
    console.log(`🌐 Current network:`, network);
    
    if (network.chainId !== 80002) {
      console.log(`🔄 Switching to Polygon Amoy testnet...`);
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x13882' }],
        });
        // Wait a moment for network switch
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          // Network not added, add it
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
        } else {
          throw switchError;
        }
      }
    }

    const signer = web3Provider.getSigner();
    
    // Verify we can get the signer address
    const signerAddress = await signer.getAddress();
    console.log(`🔍 Signer address: ${signerAddress}`);
    
    if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error(`Wallet mismatch. Expected: ${walletAddress}, Got: ${signerAddress}`);
    }

    // Use the Web3Provider for contract calls
    const contract = new ethers.Contract(this.contractAddress, this.contractABI, signer);

    const gasPrice = await web3Provider.getGasPrice();
    const adjustedGasPrice = gasPrice.mul(120).div(100);

    try {
      console.log(`🔨 Minting NFT to ${walletAddress}`);
      
      // Collection contracts don't need nextTokenIdToMint - they handle token IDs internally
      const gasEstimate = await contract.estimateGas.mintTo(walletAddress, metadataURI);
      console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);
      
      const tx = await contract.mintTo(walletAddress, metadataURI, {
        gasLimit: gasEstimate.mul(120).div(100),
        gasPrice: adjustedGasPrice
      });

      console.log(`⏳ Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);

      const tokenId = this.extractTokenIdFromReceipt(receipt);
      console.log(`🎯 Minted token ID: ${tokenId}`);

      // Verify token URI
      if (tokenId) {
        try {
          const tokenURI = await contract.tokenURI(tokenId);
          console.log(`🔍 Token ${tokenId} URI: ${tokenURI}`);
          
          if (tokenURI === metadataURI) {
            console.log(`✅ Token URI matches expected`);
          } else {
            console.log(`⚠️ Token URI mismatch`);
          }
        } catch (uriError) {
          console.log(`⚠️ Could not verify token URI:`, uriError);
        }
      }

      // Verify ownership before adding NFT to MetaMask wallet
      if (tokenId) {
        try {
          const isOwner = await this.verifyNFTOwnership(tokenId, walletAddress);
          if (isOwner) {
            await this.addNFTToMetaMask(tokenId, metadataURI);
            console.log(`✅ NFT ownership verified and added to MetaMask`);
          } else {
            console.log(`⚠️ NFT ownership verification failed - not adding to MetaMask`);
          }
        } catch (addError) {
          console.log(`⚠️ Could not add NFT to MetaMask:`, addError);
        }
      }

      return {
        success: true,
        transactionHash: tx.hash,
        tokenId: tokenId,
        receipt: receipt,
        metadataURI: metadataURI
      };

    } catch (error: any) {
      console.error(`❌ Mint failed with RPC ${rpcUrl}:`, error);
      throw error;
    }
  }

  private extractTokenIdFromReceipt(receipt: any): string | null {
    try {
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
          
          if (log.topics && log.topics[0] === transferTopic && log.topics.length >= 4) {
            const fromAddress = log.topics[1];
            if (fromAddress === "0x0000000000000000000000000000000000000000000000000000000000000000") {
              const tokenIdHex = log.topics[3];
              const tokenId = ethers.BigNumber.from(tokenIdHex).toString();
              console.log("🎯 Extracted token ID from Transfer event:", tokenId);
              return tokenId;
            }
          }
        }
      }

      const transferEvent = receipt.events?.find((event: any) => 
        event.event === 'Transfer' && 
        event.args?.from === ethers.constants.AddressZero
      );
      
      if (transferEvent && transferEvent.args?.tokenId) {
        return transferEvent.args.tokenId.toString();
      }
      
      console.log("⚠️ Could not extract token ID from receipt");
      return null;
    } catch (error) {
      console.log("❌ Error extracting token ID:", error);
      return null;
    }
  }

  private async updateNFTClaimStatus(
    nftId: string, 
    walletAddress: string, 
    tokenId: string | null, 
    transactionHash: string,
    metadataURI: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('nft_claims')
        .insert({
          nft_id: nftId,
          wallet_address: walletAddress.toLowerCase(),
          token_id: tokenId,
          transaction_hash: transactionHash,
          claimed_at: new Date().toISOString(),
          contract_address: this.contractAddress,
          claimed_blockchain: 'polygon',
          metadata_uri: metadataURI,
          metamask_compatible: true
        });

      if (error) {
        console.error('Failed to update claim status:', error);
      } else {
        console.log(`✅ Simple MetaMask NFT claim updated in database`);
      }
    } catch (error) {
      console.error('Database update error:', error);
    }
  }
}

// Export singleton instance
export const simpleMetaMaskNFTService = new SimpleMetaMaskNFTService();

// Make service globally available for debugging
if (typeof window !== 'undefined') {
  (window as any).simpleMetaMaskNFTService = simpleMetaMaskNFTService;
  
  // Add helpful debug functions to window
  (window as any).debugNFT = async (tokenId: string) => {
    return await simpleMetaMaskNFTService.debugNFTTransferIssues(tokenId);
  };
  
  (window as any).checkMyNFTs = async () => {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    const currentAccount = accounts[0];
    console.log(`🔍 Checking NFTs for account: ${currentAccount}`);
    
    // Check database for available NFTs
    const { data: nftData, error } = await supabase
      .from('nft_cid_distribution_log')
      .select('nft_id, rarity, distributed_at')
      .eq('wallet_address', currentAccount.toLowerCase())
      .order('nft_id');
    
    if (error) {
      console.error('❌ Database error:', error);
      return;
    }
    
    console.log(`📊 Found ${nftData?.length || 0} NFTs in database:`);
    nftData?.forEach(nft => {
      console.log(`  Token ${nft.nft_id}: ${nft.rarity} rarity`);
    });
    
    // Check which ones are minted
    const { data: claimData } = await supabase
      .from('nft_claims')
      .select('nft_id, token_id, transaction_hash')
      .eq('wallet_address', currentAccount.toLowerCase());
    
    console.log(`🎯 Minted NFTs: ${claimData?.length || 0}`);
    claimData?.forEach(claim => {
      console.log(`  NFT ${claim.nft_id} → Token ${claim.token_id} (${claim.transaction_hash})`);
    });
    
    return { available: nftData, minted: claimData };
  };
}

export default simpleMetaMaskNFTService;
