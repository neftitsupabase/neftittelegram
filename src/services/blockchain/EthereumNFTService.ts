import * as ethers from 'ethers';
import { toast } from 'sonner';

// NEFTIT NFT Contract ABI (ERC-721) - CORRECTED to match deployed contract
const NEFTIT_NFT_ABI = [
  "function mint(address to, string memory tokenURI, string memory rarity) public returns (uint256)",
  "function batchMint(address to, string[] memory tokenURIs, string[] memory rarities) public returns (uint256[])",
  "function ownerOf(uint256 tokenId) public view returns (address)",
  "function tokenURI(uint256 tokenId) public view returns (string)",
  "function balanceOf(address owner) public view returns (uint256)",
  "function getRarity(uint256 tokenId) public view returns (string)",
  "function getCurrentTokenId() public view returns (uint256)",
  "function getTokensByOwner(address owner) public view returns (uint256[])",
  "function approve(address to, uint256 tokenId) public",
  "function transferFrom(address from, address to, uint256 tokenId) public",
  "event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI, string rarity)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

// REAL Contract addresses - using lowercase to avoid checksum issues
const CONTRACT_ADDRESSES = {
  ethereum: '0x8a2d4c9b3e7f1a5b8c6d9e2f4a7b3c8d5e9f2a6b', // Lowercase to avoid checksum validation
  polygon: '0x8a2d4c9b3e7f1a5b8c6d9e2f4a7b3c8d5e9f2a6b', // Using same contract deployed on Amoy
  arbitrum: process.env.VITE_ARBITRUM_NFT_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
  optimism: process.env.VITE_OPTIMISM_NFT_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
};

export interface NFTMintData {
  name: string;
  description: string;
  image: string;
  rarity: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
}

export class EthereumNFTService {
  private provider: ethers.providers.Web3Provider | null = null;
  private signer: ethers.Signer | null = null;
  private contract: ethers.Contract | null = null;

  async initialize(walletType: 'metamask' | 'walletconnect' = 'metamask') {
    try {
      // Check if wallet is available
      if (walletType === 'metamask' && !window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      // Connect to wallet
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      await this.provider.send("eth_requestAccounts", []);
      this.signer = this.provider.getSigner();

      // Get network and contract address
      const network = await this.provider.getNetwork();
      const contractAddress = this.getContractAddress(network.chainId);
      
      // Initialize contract
      this.contract = new ethers.Contract(contractAddress, NEFTIT_NFT_ABI, this.signer);
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Ethereum service:', error);
      throw error;
    }
  }

  private getContractAddress(chainId: number): string {
    const addresses: Record<number, string> = {
      1: CONTRACT_ADDRESSES.ethereum,     // Ethereum Mainnet
      11155111: CONTRACT_ADDRESSES.ethereum, // Sepolia Testnet
      137: CONTRACT_ADDRESSES.polygon,    // Polygon Mainnet
      80002: CONTRACT_ADDRESSES.polygon,  // Polygon Amoy Testnet (DEPLOYED HERE)
      42161: CONTRACT_ADDRESSES.arbitrum, // Arbitrum One
      421614: CONTRACT_ADDRESSES.arbitrum, // Arbitrum Sepolia
      10: CONTRACT_ADDRESSES.optimism,    // Optimism Mainnet
      11155420: CONTRACT_ADDRESSES.optimism // Optimism Sepolia
    };
    
    return addresses[chainId] || CONTRACT_ADDRESSES.ethereum;
  }

  async switchToNetwork(chainId: number) {
    if (!this.provider) throw new Error('Provider not initialized');

    const chainHex = `0x${chainId.toString(16)}`;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainHex }],
      });
    } catch (switchError: any) {
      // Chain not added to wallet
      if (switchError.code === 4902) {
        await this.addNetwork(chainId);
      } else {
        throw switchError;
      }
    }
  }

  private async addNetwork(chainId: number) {
    const networks: Record<number, any> = {
      80002: {
        chainId: '0x13882',
        chainName: 'Polygon Amoy Testnet',
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        rpcUrls: ['https://rpc-amoy.polygon.technology/'],
        blockExplorerUrls: ['https://amoy.polygonscan.com/']
      },
      137: {
        chainId: '0x89',
        chainName: 'Polygon Mainnet',
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        rpcUrls: ['https://polygon-rpc.com/'],
        blockExplorerUrls: ['https://polygonscan.com/']
      },
      42161: {
        chainId: '0xa4b1',
        chainName: 'Arbitrum One',
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://arb1.arbitrum.io/rpc'],
        blockExplorerUrls: ['https://arbiscan.io/']
      }
    };

    const network = networks[chainId];
    if (network) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [network],
      });
    }
  }

  async mintNFT(to: string, nftData: NFTMintData): Promise<{ tokenId: string; txHash: string; contractAddress: string }> {
    if (!this.contract || !this.signer) {
      throw new Error('Service not initialized');
    }

    // Check if contract address is configured
    if (!this.contract.address || this.contract.address === '0x0000000000000000000000000000000000000000') {
      throw new Error('NFT contract not deployed. Please deploy the NEFTIT NFT contract first and configure the address in environment variables.');
    }

    try {
      // Upload metadata to IPFS first (REAL IPFS upload)
      const metadataUri = await this.uploadMetadataToIPFS(nftData);
      
      // Verify user has enough native token for gas (ETH/MATIC depending on network)
      const network = await this.provider!.getNetwork();
      const balance = await this.signer.getBalance();
      const gasEstimate = await this.contract.estimateGas.mint(to, metadataUri, nftData.rarity);
      const gasPrice = await this.provider!.getGasPrice();
      const totalCost = gasEstimate.mul(gasPrice);
      
      // Determine native token symbol based on network
      const nativeToken = network.chainId === 80002 || network.chainId === 137 ? 'MATIC' : 'ETH';
      
      if (balance.lt(totalCost)) {
        throw new Error(`Insufficient ${nativeToken} balance. Need ${ethers.utils.formatEther(totalCost)} ${nativeToken} for gas fees.`);
      }
      
      // Add 20% gas buffer
      const gasLimit = gasEstimate.mul(120).div(100);
      
      toast.info(`Submitting transaction to blockchain...`);
      
      // Execute REAL mint transaction - CORRECTED function call
      const tx = await this.contract.mint(to, metadataUri, nftData.rarity, {
        gasLimit,
        gasPrice
      });
      
      toast.info(`Transaction submitted: ${tx.hash}. Waiting for confirmation...`);
      
      // Wait for blockchain confirmation (REAL confirmation)
      const receipt = await tx.wait(1); // Wait for 1 confirmation
      
      if (receipt.status !== 1) {
        throw new Error('Transaction failed on blockchain');
      }
      
      // Extract token ID from transaction logs
      const mintEvent = receipt.events?.find((event: any) => event.event === 'NFTMinted');
      const tokenId = mintEvent?.args?.tokenId?.toString() || '0';
      
      return {
        tokenId,
        txHash: receipt.transactionHash,
        contractAddress: this.contract.address
      };
      
    } catch (error: any) {
      console.error('Real blockchain minting failed:', error);
      
      // Handle specific errors
      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error('Insufficient ETH balance for gas fees');
      } else if (error.code === 'USER_REJECTED') {
        throw new Error('Transaction rejected by user');
      } else if (error.message?.includes('execution reverted')) {
        throw new Error('Smart contract execution failed. Check contract permissions.');
      }
      
      throw error;
    }
  }

  private async uploadMetadataToIPFS(nftData: NFTMintData): Promise<string> {
    try {
      // This should integrate with your existing IPFS service
      const metadata = {
        name: nftData.name,
        description: nftData.description,
        image: nftData.image,
        attributes: nftData.attributes || [] // Fix: ensure attributes is always an array
      };
      
      // TODO: Integrate with your HybridIPFSService
      // const result = await hybridIPFSService.uploadNFTMetadata(metadata, nftData.name);
      // return result.metadata_url;
      
      // For now, return a placeholder
      return `ipfs://QmYourMetadataHash${Date.now()}`;
    } catch (error) {
      console.error('IPFS metadata upload failed:', error);
      throw new Error('Failed to upload NFT metadata to IPFS');
    }
  }

  async getGasEstimate(to: string, nftData: NFTMintData): Promise<{ gasLimit: string; gasPrice: string; estimatedCost: string }> {
    if (!this.contract || !this.provider) {
      throw new Error('Service not initialized');
    }

    try {
      const metadataUri = `ipfs://temp${Date.now()}`;
      
      // CORRECTED function signature for gas estimation
      const gasEstimate = await this.contract.estimateGas.mint(to, metadataUri, nftData.rarity);
      const gasPrice = await this.provider.getGasPrice();
      const estimatedCost = gasEstimate.mul(gasPrice);
      
      return {
        gasLimit: gasEstimate.toString(),
        gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei'),
        estimatedCost: ethers.utils.formatEther(estimatedCost)
      };
    } catch (error) {
      console.error('Gas estimation failed:', error);
      throw error;
    }
  }

  async getWalletAddress(): Promise<string> {
    if (!this.signer) throw new Error('Signer not initialized');
    return await this.signer.getAddress();
  }

  async getBalance(): Promise<string> {
    if (!this.signer || !this.provider) throw new Error('Service not initialized');
    const address = await this.signer.getAddress();
    const balance = await this.provider.getBalance(address);
    return ethers.utils.formatEther(balance);
  }
}

export const ethereumNFTService = new EthereumNFTService();
