import { ethers } from 'ethers';
import { supabase } from '../lib/supabase';

export class DirectMintNFTService {
  private rpcEndpoints: string[];
  private contractABI: any[];

  constructor() {
    this.rpcEndpoints = [
      'https://polygon-amoy.g.alchemy.com/v2/demo',
      'https://rpc-amoy.polygon.technology/',
      'https://polygon-amoy.drpc.org',
      'https://polygon-amoy-bor-rpc.publicnode.com',
      'https://rpc.ankr.com/polygon_amoy'
    ];

    // ERC721 ABI for direct minting
    this.contractABI = [
      {
        "inputs": [
          {"name": "to", "type": "address"},
          {"name": "uri", "type": "string"}
        ],
        "name": "mintTo",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {"name": "to", "type": "address"},
          {"name": "tokenId", "type": "uint256"},
          {"name": "uri", "type": "string"}
        ],
        "name": "safeMint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "tokenURI",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
      }
    ];
  }

  async directMintNFT(nftId: string, walletAddress: string): Promise<any> {
    console.log(`🎯 Starting direct mint for NFT ${nftId} to ${walletAddress}`);

    try {
      // Get NFT data from database
      const { data: nftData, error } = await supabase
        .from('nfts')
        .select('*')
        .eq('id', nftId)
        .single();

      if (error || !nftData) {
        throw new Error(`NFT not found: ${error?.message}`);
      }

      // Construct metadata URI
      let metadataURI = "";
      if (nftData.metadata_uri) {
        metadataURI = nftData.metadata_uri;
      } else if (nftData.ipfs_hash) {
        metadataURI = `https://gateway.pinata.cloud/ipfs/${nftData.ipfs_hash}`;
      } else {
        throw new Error("No metadata URI or IPFS hash available");
      }

      console.log(`📋 Metadata URI: ${metadataURI}`);

      // Try minting with each RPC endpoint
      for (const rpcUrl of this.rpcEndpoints) {
        try {
          const result = await this.attemptDirectMint(rpcUrl, walletAddress, metadataURI);
          if (result.success) {
            console.log(`✅ Direct mint successful with RPC: ${rpcUrl}`);
            return result;
          }
        } catch (error: any) {
          console.log(`❌ RPC ${rpcUrl} failed:`, error.message);
          continue;
        }
      }

      throw new Error("All RPC endpoints failed for direct minting");

    } catch (error: any) {
      console.error("❌ Direct mint failed:", error);
      throw error;
    }
  }

  private async attemptDirectMint(rpcUrl: string, walletAddress: string, metadataURI: string): Promise<any> {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // Get signer from MetaMask
    if (!window.ethereum) {
      throw new Error("MetaMask not found");
    }

    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = web3Provider.getSigner();
    
    // Ensure we're on the correct network
    const network = await provider.getNetwork();
    if (network.chainId !== 80002) {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x13882' }], // 80002 in hex
      });
    }

    const contractAddress = process.env.VITE_NFT_CONTRACT_ADDRESS;
    if (!contractAddress) {
      throw new Error("Contract address not configured");
    }

    const contract = new ethers.Contract(contractAddress, this.contractABI, provider);
    const contractWithSigner = contract.connect(signer);

    // Get gas price
    const gasPrice = await provider.getGasPrice();
    const adjustedGasPrice = gasPrice.mul(120).div(100); // 20% buffer

    try {
      // Try mintTo function first (most common)
      console.log(`🔨 Attempting mintTo function...`);
      
      const mintTx = await contractWithSigner.mintTo(walletAddress, metadataURI, {
        gasLimit: ethers.BigNumber.from("300000"),
        gasPrice: adjustedGasPrice
      });

      console.log(`⏳ Mint transaction sent: ${mintTx.hash}`);
      const receipt = await mintTx.wait();
      console.log(`✅ Mint completed successfully`);

      // Extract token ID from receipt
      const tokenId = this.extractTokenIdFromReceipt(receipt);
      
      // Verify token URI
      if (tokenId) {
        try {
          const tokenURI = await contract.tokenURI(tokenId);
          console.log(`🔍 Token ${tokenId} URI: ${tokenURI}`);
        } catch (error) {
          console.log(`⚠️ Could not verify token URI:`, error);
        }
      }

      return {
        success: true,
        transactionHash: mintTx.hash,
        tokenId: tokenId,
        receipt: receipt
      };

    } catch (mintToError: any) {
      console.log(`⚠️ mintTo failed, trying safeMint:`, mintToError.message);
      
      try {
        // Try safeMint as fallback
        const nextTokenId = Date.now(); // Simple token ID generation
        
        const safeMintTx = await contractWithSigner.safeMint(walletAddress, nextTokenId, metadataURI, {
          gasLimit: ethers.BigNumber.from("300000"),
          gasPrice: adjustedGasPrice
        });

        console.log(`⏳ SafeMint transaction sent: ${safeMintTx.hash}`);
        const receipt = await safeMintTx.wait();
        console.log(`✅ SafeMint completed successfully`);

        return {
          success: true,
          transactionHash: safeMintTx.hash,
          tokenId: nextTokenId,
          receipt: receipt
        };

      } catch (safeMintError: any) {
        throw new Error(`Both mintTo and safeMint failed: ${safeMintError.message}`);
      }
    }
  }

  private extractTokenIdFromReceipt(receipt: any): string | null {
    try {
      // Look for Transfer event which indicates minting
      const transferEvent = receipt.events?.find((event: any) => 
        event.event === 'Transfer' && event.args?.from === ethers.constants.AddressZero
      );
      
      if (transferEvent && transferEvent.args?.tokenId) {
        return transferEvent.args.tokenId.toString();
      }
      
      return null;
    } catch (error) {
      console.log("Could not extract token ID from receipt");
      return null;
    }
  }
}
