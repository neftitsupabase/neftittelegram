import { ethers } from 'ethers';
import { supabase } from '../lib/supabase';

export class NFTCollectionMintService {
  private rpcEndpoints: string[];
  private contractABI: any[];
  private contractAddress: string;

  constructor() {
    this.contractAddress = "0x5Bb23220cC12585264fCd144C448eF222c8572A2";
    
    this.rpcEndpoints = [
      'https://polygon-amoy.g.alchemy.com/v2/demo',
      'https://rpc-amoy.polygon.technology/',
      'https://polygon-amoy.drpc.org',
      'https://polygon-amoy-bor-rpc.publicnode.com',
      'https://rpc.ankr.com/polygon_amoy'
    ];

    // NFT Collection ABI - focused on mintTo function
    this.contractABI = [
      {
        "inputs": [
          {"internalType": "address", "name": "_to", "type": "address"},
          {"internalType": "string", "name": "_uri", "type": "string"}
        ],
        "name": "mintTo",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [{"internalType": "uint256", "name": "_tokenId", "type": "uint256"}],
        "name": "tokenURI",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {"internalType": "uint256", "name": "_tokenId", "type": "uint256"},
          {"internalType": "string", "name": "_uri", "type": "string"}
        ],
        "name": "setTokenURI",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "nextTokenIdToMint",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ];
  }

  async mintNFT(nftId: string, walletAddress: string): Promise<any> {
    console.log(`🎯 Starting NFT mint for NFT ${nftId} to ${walletAddress}`);
    console.log(`📝 Using NFT Collection contract: ${this.contractAddress}`);

    try {
      // Get NFT metadata from CID distribution log
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

      // Construct metadata URI from CID pool data
      let metadataURI = "";
      const cidPoolData = Array.isArray(nftData.nft_cid_pools) ? nftData.nft_cid_pools[0] : nftData.nft_cid_pools;
      if (cidPoolData?.metadata_cid) {
        metadataURI = `https://gateway.pinata.cloud/ipfs/${cidPoolData.metadata_cid}`;
      } else if (nftData.cid) {
        metadataURI = `https://gateway.pinata.cloud/ipfs/${nftData.cid}`;
      } else {
        throw new Error('No metadata CID found for NFT');
      }

      console.log(`📋 Metadata URI: ${metadataURI}`);

      // Try minting with each RPC endpoint
      for (const rpcUrl of this.rpcEndpoints) {
        try {
          const result = await this.attemptMintWithRPC(rpcUrl, walletAddress, metadataURI);
          if (result.success) {
            console.log(`✅ NFT mint successful with RPC: ${rpcUrl}`);
            
            // Update database to mark NFT as claimed
            await this.updateNFTClaimStatus(nftId, walletAddress, result.tokenId, result.transactionHash);
            
            return result;
          }
        } catch (error: any) {
          console.log(`❌ RPC ${rpcUrl} failed:`, error.message);
          continue;
        }
      }

      throw new Error("All RPC endpoints failed for NFT minting");

    } catch (error: any) {
      console.error("❌ NFT mint failed:", error);
      throw error;
    }
  }

  private async attemptMintWithRPC(rpcUrl: string, walletAddress: string, metadataURI: string): Promise<any> {
    console.log(`🔗 Attempting mint with RPC: ${rpcUrl}`);
    
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // Get signer from MetaMask
    if (!window.ethereum) {
      throw new Error("MetaMask not found");
    }

    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = web3Provider.getSigner();
    
    // Ensure we're on the correct network (Polygon Amoy)
    const network = await provider.getNetwork();
    if (network.chainId !== 80002) {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x13882' }], // 80002 in hex
      });
    }

    const contract = new ethers.Contract(this.contractAddress, this.contractABI, provider);
    const contractWithSigner = contract.connect(signer);

    // Get gas price with buffer
    const gasPrice = await provider.getGasPrice();
    const adjustedGasPrice = gasPrice.mul(120).div(100); // 20% buffer

    try {
      // Get next token ID for reference
      const nextTokenId = await contract.nextTokenIdToMint();
      console.log(`🔢 Next token ID to mint: ${nextTokenId.toString()}`);

      // Estimate gas for mintTo
      const gasEstimate = await contractWithSigner.estimateGas.mintTo(walletAddress, metadataURI);
      console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);

      // Execute mintTo transaction
      console.log(`🔨 Minting NFT to ${walletAddress} with metadata: ${metadataURI}`);
      
      const mintTx = await contractWithSigner.mintTo(walletAddress, metadataURI, {
        gasLimit: gasEstimate.mul(120).div(100), // 20% buffer
        gasPrice: adjustedGasPrice
      });

      console.log(`⏳ Mint transaction sent: ${mintTx.hash}`);
      const receipt = await mintTx.wait();
      console.log(`✅ Mint transaction confirmed in block: ${receipt.blockNumber}`);

      // Extract token ID from receipt
      const tokenId = this.extractTokenIdFromReceipt(receipt);
      console.log(`🎯 Minted token ID: ${tokenId}`);

      // Verify token URI
      if (tokenId) {
        try {
          const tokenURI = await contract.tokenURI(tokenId);
          console.log(`🔍 Token ${tokenId} URI: ${tokenURI}`);
          
          if (tokenURI === metadataURI) {
            console.log(`✅ Token URI matches expected metadata URI`);
          } else {
            console.log(`⚠️ Token URI mismatch - Expected: ${metadataURI}, Got: ${tokenURI}`);
          }
        } catch (uriError) {
          console.log(`⚠️ Could not verify token URI:`, uriError);
        }
      }

      return {
        success: true,
        transactionHash: mintTx.hash,
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
      console.log("🔍 DEBUG: Receipt logs:", receipt.logs);
      
      // Parse logs manually since events might not be parsed
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          // Transfer event signature: Transfer(address,address,uint256)
          const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
          
          if (log.topics && log.topics[0] === transferTopic && log.topics.length >= 4) {
            // Check if it's a mint (from address is 0x0)
            const fromAddress = log.topics[1];
            if (fromAddress === "0x0000000000000000000000000000000000000000000000000000000000000000") {
              // Token ID is in the third topic for Transfer events
              const tokenIdHex = log.topics[3];
              const tokenId = ethers.BigNumber.from(tokenIdHex).toString();
              console.log("🎯 Extracted token ID from Transfer event:", tokenId);
              return tokenId;
            }
          }
        }
      }

      // Fallback: Look for parsed events
      const transferEvent = receipt.events?.find((event: any) => 
        event.event === 'Transfer' && 
        event.args?.from === ethers.constants.AddressZero
      );
      
      if (transferEvent && transferEvent.args?.tokenId) {
        return transferEvent.args.tokenId.toString();
      }

      // Alternative: Look for TokensMinted event
      const mintEvent = receipt.events?.find((event: any) => 
        event.event === 'TokensMinted'
      );
      
      if (mintEvent && mintEvent.args?.tokenIdMinted) {
        return mintEvent.args.tokenIdMinted.toString();
      }
      
      console.log("⚠️ Could not extract token ID from receipt");
      return null;
    } catch (error) {
      console.log("❌ Error extracting token ID from receipt:", error);
      return null;
    }
  }

  private async updateNFTClaimStatus(nftId: string, walletAddress: string, tokenId: string | null, transactionHash: string): Promise<void> {
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
          claimed_blockchain: 'polygon' // Add required blockchain field
        });

      if (error) {
        console.error('Failed to update claim status:', error);
      } else {
        console.log(`✅ NFT claim status updated in database`);
      }
    } catch (error) {
      console.error('Database update error:', error);
    }
  }
}
