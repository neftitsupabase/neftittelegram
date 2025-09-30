import { ethers } from 'ethers';

/**
 * Diagnostic tool to check why MetaMask NFT images are not displaying
 */
export class MetaMaskImageDiagnostic {
  private contractAddress = "0x5Bb23220cC12585264fCd144C448eF222c8572A2";
  private contractABI = [
    "function tokenURI(uint256 tokenId) view returns (string)"
  ];

  /**
   * Diagnose NFT image display issues for a specific token
   */
  async diagnoseNFTImage(tokenId: string): Promise<any> {
    console.log(`🔍 Diagnosing NFT image issues for token ID: ${tokenId}`);
    
    const results = {
      tokenId,
      tokenURI: null,
      metadata: null,
      imageURL: null,
      imageAccessible: false,
      corsSupported: false,
      gatewayTests: [],
      recommendations: []
    };

    try {
      // Step 1: Get token URI from contract
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(this.contractAddress, this.contractABI, provider);
        
        results.tokenURI = await contract.tokenURI(tokenId);
        console.log(`📋 Token URI: ${results.tokenURI}`);
      }

      // Step 2: Fetch metadata
      if (results.tokenURI) {
        try {
          const metadataResponse = await fetch(results.tokenURI);
          if (metadataResponse.ok) {
            results.metadata = await metadataResponse.json();
            results.imageURL = results.metadata.image;
            console.log(`📄 Metadata loaded:`, results.metadata);
            console.log(`🖼️ Image URL: ${results.imageURL}`);
          } else {
            console.log(`❌ Failed to fetch metadata: ${metadataResponse.status}`);
            results.recommendations.push("Metadata URL is not accessible");
          }
        } catch (error) {
          console.log(`❌ Metadata fetch error:`, error);
          results.recommendations.push("Metadata URL fetch failed");
        }
      }

      // Step 3: Test image accessibility
      if (results.imageURL) {
        results.imageAccessible = await this.testImageAccessibility(results.imageURL);
        results.corsSupported = await this.testCORSSupport(results.imageURL);
        
        // Test alternative gateways
        const imageCID = this.extractCIDFromURL(results.imageURL);
        if (imageCID) {
          results.gatewayTests = await this.testAlternativeGateways(imageCID);
        }
      }

      // Step 4: Generate recommendations
      this.generateRecommendations(results);

      return results;

    } catch (error) {
      console.error(`❌ Diagnostic failed:`, error);
      results.recommendations.push(`Diagnostic failed: ${error.message}`);
      return results;
    }
  }

  /**
   * Test if image URL is accessible
   */
  private async testImageAccessibility(imageURL: string): Promise<boolean> {
    try {
      console.log(`🔍 Testing image accessibility: ${imageURL}`);
      
      // Test with fetch
      const response = await fetch(imageURL, { 
        method: 'HEAD',
        mode: 'cors'
      });
      
      if (response.ok) {
        console.log(`✅ Image URL accessible via fetch`);
        return true;
      } else {
        console.log(`❌ Image URL not accessible: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ Image accessibility test failed:`, error);
      return false;
    }
  }

  /**
   * Test CORS support for the image URL
   */
  private async testCORSSupport(imageURL: string): Promise<boolean> {
    try {
      console.log(`🔍 Testing CORS support: ${imageURL}`);
      
      const response = await fetch(imageURL, { 
        method: 'HEAD',
        mode: 'cors'
      });
      
      const corsHeader = response.headers.get('access-control-allow-origin');
      if (corsHeader === '*' || corsHeader) {
        console.log(`✅ CORS supported: ${corsHeader}`);
        return true;
      } else {
        console.log(`❌ CORS not supported`);
        return false;
      }
    } catch (error) {
      console.log(`❌ CORS test failed:`, error);
      return false;
    }
  }

  /**
   * Extract CID from IPFS URL
   */
  private extractCIDFromURL(url: string): string | null {
    const cidMatch = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    return cidMatch ? cidMatch[1] : null;
  }

  /**
   * Test alternative IPFS gateways
   */
  private async testAlternativeGateways(cid: string): Promise<any[]> {
    const gateways = [
      'https://ipfs.io/ipfs/',
      'https://gateway.pinata.cloud/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://dweb.link/ipfs/',
      'https://nftstorage.link/ipfs/'
    ];

    const results = [];

    for (const gateway of gateways) {
      const testURL = `${gateway}${cid}`;
      
      try {
        console.log(`🔍 Testing gateway: ${testURL}`);
        
        const response = await fetch(testURL, { 
          method: 'HEAD',
          mode: 'cors'
        });
        
        const result = {
          gateway,
          url: testURL,
          accessible: response.ok,
          status: response.status,
          corsSupported: !!response.headers.get('access-control-allow-origin'),
          contentType: response.headers.get('content-type')
        };
        
        results.push(result);
        
        if (response.ok) {
          console.log(`✅ Gateway working: ${gateway}`);
        } else {
          console.log(`❌ Gateway failed: ${gateway} (${response.status})`);
        }
        
      } catch (error) {
        results.push({
          gateway,
          url: testURL,
          accessible: false,
          error: error.message
        });
        console.log(`❌ Gateway error: ${gateway} - ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(results: any): void {
    if (!results.tokenURI) {
      results.recommendations.push("Token URI not found - NFT may not be properly minted");
    }

    if (!results.metadata) {
      results.recommendations.push("Metadata not accessible - check IPFS gateway");
    }

    if (!results.imageURL) {
      results.recommendations.push("No image URL in metadata - metadata structure issue");
    }

    if (results.imageURL && !results.imageAccessible) {
      results.recommendations.push("Image URL not accessible - try alternative IPFS gateway");
    }

    if (results.imageURL && !results.corsSupported) {
      results.recommendations.push("CORS not supported - MetaMask cannot load image");
    }

    // Check for working alternative gateways
    const workingGateways = results.gatewayTests?.filter(test => test.accessible && test.corsSupported);
    if (workingGateways && workingGateways.length > 0) {
      results.recommendations.push(`Working gateways found: ${workingGateways.map(g => g.gateway).join(', ')}`);
      results.recommendations.push("Re-mint NFT with MetaMaskCompatibleNFTService for better gateway selection");
    }

    if (results.gatewayTests && results.gatewayTests.every(test => !test.accessible)) {
      results.recommendations.push("No IPFS gateways accessible - content may not be properly pinned");
    }
  }

  /**
   * Run complete diagnostic and log results
   */
  async runDiagnostic(tokenId: string): Promise<void> {
    console.log("🚀 Starting MetaMask NFT Image Diagnostic...");
    
    const results = await this.diagnoseNFTImage(tokenId);
    
    console.log("\n📊 DIAGNOSTIC RESULTS:");
    console.log("======================");
    console.log(`Token ID: ${results.tokenId}`);
    console.log(`Token URI: ${results.tokenURI}`);
    console.log(`Image URL: ${results.imageURL}`);
    console.log(`Image Accessible: ${results.imageAccessible}`);
    console.log(`CORS Supported: ${results.corsSupported}`);
    
    if (results.gatewayTests && results.gatewayTests.length > 0) {
      console.log("\n🌐 Gateway Test Results:");
      results.gatewayTests.forEach(test => {
        console.log(`  ${test.gateway}: ${test.accessible ? '✅' : '❌'} ${test.corsSupported ? '(CORS ✅)' : '(CORS ❌)'}`);
      });
    }
    
    if (results.recommendations.length > 0) {
      console.log("\n💡 RECOMMENDATIONS:");
      results.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }
    
    console.log("\n🎯 Diagnostic complete!");
  }
}

// Export singleton instance
export const metaMaskImageDiagnostic = new MetaMaskImageDiagnostic();
export default metaMaskImageDiagnostic;
