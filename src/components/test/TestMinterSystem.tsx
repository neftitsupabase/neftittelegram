import React, { useState, useEffect } from 'react';
import { adminMinterService } from '../../services/AdminMinterService';
import { web3MetaMaskNFTService } from '../../services/Web3MetaMaskNFTService';
import { contractPermissionService } from '../../services/ContractPermissionService';

export const TestMinterSystem: React.FC = () => {
  const [testWallet, setTestWallet] = useState('');
  const [testNftId, setTestNftId] = useState('');
  const [adminStatus, setAdminStatus] = useState<any>(null);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAdminStatus();
  }, []);

  const loadAdminStatus = async () => {
    try {
      const status = await adminMinterService.getAdminStatus();
      setAdminStatus(status);
      addTestResult(`Admin Status: ${JSON.stringify(status, null, 2)}`);
    } catch (error: any) {
      addTestResult(`❌ Admin Status Error: ${error.message}`);
    }
  };

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testAdminConfiguration = async () => {
    setIsLoading(true);
    addTestResult('🔍 Testing Admin Configuration...');
    
    try {
      const status = await adminMinterService.getAdminStatus();
      
      if (status.hasAdminAccount) {
        addTestResult(`✅ Admin Account: ${status.adminAddress}`);
        addTestResult(`✅ Has Admin Role: ${status.hasAdminRole}`);
        addTestResult(`✅ Balance: ${status.balance}`);
      } else {
        addTestResult('❌ No admin account configured');
      }
    } catch (error: any) {
      addTestResult(`❌ Admin test failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testRoleGranting = async () => {
    if (!testWallet.trim()) {
      addTestResult('❌ Please enter a test wallet address');
      return;
    }

    setIsLoading(true);
    addTestResult(`🔍 Testing role granting for: ${testWallet}`);
    
    try {
      // Check current role status
      const hasRoleBefore = await contractPermissionService.hasMinterRole(testWallet);
      addTestResult(`Current MINTER_ROLE status: ${hasRoleBefore}`);

      // Try to grant role
      const result = await adminMinterService.grantMinterRoleToUser(testWallet);
      
      if (result.success) {
        addTestResult(`✅ Role granted: ${result.message}`);
        if (result.txHash) {
          addTestResult(`📝 Transaction: ${result.txHash}`);
        }

        // Verify role was granted
        setTimeout(async () => {
          const hasRoleAfter = await contractPermissionService.hasMinterRole(testWallet);
          addTestResult(`Verified MINTER_ROLE status: ${hasRoleAfter}`);
        }, 3000);
      } else {
        addTestResult(`❌ Role grant failed: ${result.message}`);
      }
    } catch (error: any) {
      addTestResult(`❌ Role granting error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testNFTMinting = async () => {
    if (!testWallet.trim() || !testNftId.trim()) {
      addTestResult('❌ Please enter both wallet address and NFT ID');
      return;
    }

    setIsLoading(true);
    addTestResult(`🔍 Testing NFT minting for wallet: ${testWallet}, NFT ID: ${testNftId}`);
    
    try {
      const result = await web3MetaMaskNFTService.mintNFT(testNftId, testWallet);
      
      if (result.success) {
        addTestResult(`✅ NFT minted successfully!`);
        addTestResult(`📝 Transaction: ${result.transactionHash}`);
        addTestResult(`🎯 Token ID: ${result.tokenId}`);
        addTestResult(`🔗 Metadata: ${result.metadataURI}`);
      } else {
        addTestResult(`❌ NFT minting failed`);
      }
    } catch (error: any) {
      addTestResult(`❌ NFT minting error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testCompleteFlow = async () => {
    if (!testWallet.trim()) {
      addTestResult('❌ Please enter a test wallet address');
      return;
    }

    setIsLoading(true);
    addTestResult('🚀 Testing Complete Flow: Admin → Role Grant → NFT Mint');
    
    try {
      // Step 1: Check admin
      addTestResult('Step 1: Checking admin configuration...');
      await testAdminConfiguration();

      // Step 2: Grant role
      addTestResult('Step 2: Granting MINTER_ROLE...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await testRoleGranting();

      // Step 3: Test minting (if NFT ID provided)
      if (testNftId.trim()) {
        addTestResult('Step 3: Testing NFT minting...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        await testNFTMinting();
      }

      addTestResult('✅ Complete flow test finished!');
    } catch (error: any) {
      addTestResult(`❌ Complete flow error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Minter System Test Console</h2>
      
      {/* Admin Status Display */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Current Admin Status</h3>
        {adminStatus ? (
          <div className="space-y-2">
            <p><strong>Has Admin Account:</strong> 
              <span className={`ml-2 px-2 py-1 rounded text-sm ${adminStatus.hasAdminAccount ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {adminStatus.hasAdminAccount ? 'Yes' : 'No'}
              </span>
            </p>
            {adminStatus.hasAdminAccount && (
              <>
                <p><strong>Admin Address:</strong> <code className="bg-gray-200 px-2 py-1 rounded">{adminStatus.adminAddress}</code></p>
                <p><strong>Has Admin Role:</strong> 
                  <span className={`ml-2 px-2 py-1 rounded text-sm ${adminStatus.hasAdminRole ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {adminStatus.hasAdminRole ? 'Yes' : 'No'}
                  </span>
                </p>
                <p><strong>Balance:</strong> {adminStatus.balance}</p>
              </>
            )}
          </div>
        ) : (
          <p className="text-gray-500">Loading admin status...</p>
        )}
      </div>

      {/* Test Inputs */}
      <div className="mb-6 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Test Parameters</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Test Wallet Address:</label>
            <input
              type="text"
              value={testWallet}
              onChange={(e) => setTestWallet(e.target.value)}
              placeholder="0x..."
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Test NFT ID (optional for minting test):</label>
            <input
              type="text"
              value={testNftId}
              onChange={(e) => setTestNftId(e.target.value)}
              placeholder="nft_123..."
              className="w-full p-2 border rounded"
            />
          </div>
        </div>
      </div>

      {/* Test Buttons */}
      <div className="mb-6 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Test Functions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={testAdminConfiguration}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Test Admin
          </button>
          <button
            onClick={testRoleGranting}
            disabled={isLoading || !testWallet.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Test Role Grant
          </button>
          <button
            onClick={testNFTMinting}
            disabled={isLoading || !testWallet.trim() || !testNftId.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            Test NFT Mint
          </button>
          <button
            onClick={testCompleteFlow}
            disabled={isLoading || !testWallet.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            Test Complete Flow
          </button>
        </div>
      </div>

      {/* Test Results */}
      <div className="p-4 border rounded-lg">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Test Results</h3>
          <button
            onClick={clearResults}
            className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
          >
            Clear
          </button>
        </div>
        
        <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
          {testResults.length === 0 ? (
            <p className="text-gray-500">No test results yet. Run a test to see output.</p>
          ) : (
            testResults.map((result, index) => (
              <div key={index} className="mb-1">
                {result}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Testing Instructions</h3>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          <li>First, run "Test Admin" to verify your admin configuration</li>
          <li>Enter a test wallet address (can be any valid Ethereum address)</li>
          <li>Run "Test Role Grant" to verify automatic permission granting</li>
          <li>If you have an NFT ID, run "Test NFT Mint" to verify end-to-end minting</li>
          <li>Use "Test Complete Flow" to run all tests in sequence</li>
        </ol>
      </div>
    </div>
  );
};
