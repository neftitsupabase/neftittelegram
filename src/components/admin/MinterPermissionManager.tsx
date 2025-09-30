import React, { useState, useEffect } from 'react';
import { adminMinterService } from '../../services/AdminMinterService';
import { contractPermissionService } from '../../services/ContractPermissionService';
import { useGrantMinterRole } from '../../services/ContractPermissionService';
import { useSendTransaction } from 'thirdweb/react';
import { prepareContractCall } from 'thirdweb';

interface AdminStatus {
  hasAdminAccount: boolean;
  adminAddress?: string;
  hasAdminRole?: boolean;
  balance?: string;
}

interface MinterAddress {
  address: string;
  hasRole: boolean;
}

export const MinterPermissionManager: React.FC = () => {
  const [adminStatus, setAdminStatus] = useState<AdminStatus>({ hasAdminAccount: false });
  const [minterAddresses, setMinterAddresses] = useState<string[]>([]);
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  // Thirdweb React hooks for transaction handling
  const { mutate: sendTransaction, isPending: isTransactionPending } = useSendTransaction();
  const { grantMinterRole, revokeMinterRole } = useGrantMinterRole();

  useEffect(() => {
    loadAdminStatus();
    loadMinterAddresses();
  }, []);

  const loadAdminStatus = async () => {
    try {
      const status = await adminMinterService.getAdminStatus();
      setAdminStatus(status);
    } catch (error) {
      console.error('Failed to load admin status:', error);
    }
  };

  const loadMinterAddresses = async () => {
    try {
      const addresses = await adminMinterService.getAllMinterAddresses();
      setMinterAddresses(addresses);
    } catch (error) {
      console.error('Failed to load minter addresses:', error);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleGrantMinterRole = async () => {
    if (!newWalletAddress.trim()) {
      showMessage('Please enter a wallet address', 'error');
      return;
    }

    setIsLoading(true);
    try {
      // Try automatic granting first (if admin account is configured)
      const result = await adminMinterService.grantMinterRoleToUser(newWalletAddress.trim());
      
      if (result.success) {
        showMessage(`MINTER_ROLE granted successfully! ${result.txHash ? `TX: ${result.txHash}` : ''}`, 'success');
        setNewWalletAddress('');
        await loadMinterAddresses();
      } else {
        // Fall back to manual granting via user's wallet using Thirdweb pattern
        showMessage('Automatic granting failed. Please approve the transaction in your wallet.', 'info');
        
        const grantTransaction = contractPermissionService.prepareGrantMinterRole(newWalletAddress.trim());
        
        sendTransaction(grantTransaction, {
          onSuccess: (result) => {
            showMessage(`MINTER_ROLE granted successfully! TX: ${result.transactionHash}`, 'success');
            setNewWalletAddress('');
            loadMinterAddresses();
          },
          onError: (error) => {
            showMessage(`Transaction failed: ${error.message}`, 'error');
          }
        });
      }
    } catch (error: any) {
      showMessage(`Failed to grant MINTER_ROLE: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeMinterRole = async (address: string) => {
    if (!confirm(`Are you sure you want to revoke MINTER_ROLE from ${address}?`)) {
      return;
    }

    try {
      showMessage('Please approve the transaction in your wallet.', 'info');
      
      const revokeTransaction = contractPermissionService.prepareRevokeMinterRole(address);
      
      sendTransaction(revokeTransaction, {
        onSuccess: (result) => {
          showMessage(`MINTER_ROLE revoked successfully! TX: ${result.transactionHash}`, 'success');
          loadMinterAddresses();
        },
        onError: (error) => {
          showMessage(`Transaction failed: ${error.message}`, 'error');
        }
      });
    } catch (error: any) {
      showMessage(`Failed to revoke MINTER_ROLE: ${error.message}`, 'error');
    }
  };

  const handleBatchGrant = async () => {
    const addresses = newWalletAddress.split('\n').map(addr => addr.trim()).filter(addr => addr);
    
    if (addresses.length === 0) {
      showMessage('Please enter wallet addresses (one per line)', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const result = await adminMinterService.batchGrantMinterRole(addresses);
      
      let message = '';
      if (result.successful.length > 0) {
        message += `✅ Granted to ${result.successful.length} wallets. `;
      }
      if (result.failed.length > 0) {
        message += `❌ Failed for ${result.failed.length} wallets.`;
      }
      
      showMessage(message, result.failed.length === 0 ? 'success' : 'info');
      setNewWalletAddress('');
      await loadMinterAddresses();
    } catch (error: any) {
      showMessage(`Batch grant failed: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">NFT Minter Permission Manager</h2>
      
      {/* Admin Status */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Admin Status</h3>
        {adminStatus.hasAdminAccount ? (
          <div className="space-y-2">
            <p><strong>Admin Address:</strong> <code className="bg-gray-200 px-2 py-1 rounded">{adminStatus.adminAddress}</code></p>
            <p><strong>Has Admin Role:</strong> 
              <span className={`ml-2 px-2 py-1 rounded text-sm ${adminStatus.hasAdminRole ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {adminStatus.hasAdminRole ? 'Yes' : 'No'}
              </span>
            </p>
            <p><strong>Balance:</strong> {adminStatus.balance}</p>
          </div>
        ) : (
          <div className="text-yellow-600">
            <p>⚠️ No admin account configured</p>
            <p className="text-sm mt-1">Set VITE_ADMIN_PRIVATE_KEY in your environment variables to enable automatic role granting.</p>
          </div>
        )}
      </div>

      {/* Message Display */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${
          messageType === 'success' ? 'bg-green-100 text-green-800' :
          messageType === 'error' ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {message}
        </div>
      )}

      {/* Grant Minter Role */}
      <div className="mb-6 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Grant MINTER_ROLE</h3>
        <div className="space-y-3">
          <textarea
            value={newWalletAddress}
            onChange={(e) => setNewWalletAddress(e.target.value)}
            placeholder="Enter wallet address(es) - one per line for batch processing"
            className="w-full p-3 border rounded-lg resize-vertical"
            rows={3}
          />
          <div className="flex space-x-3">
            <button
              onClick={handleGrantMinterRole}
              disabled={isLoading || isTransactionPending || !newWalletAddress.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading || isTransactionPending ? 'Processing...' : 'Grant Single Role'}
            </button>
            <button
              onClick={handleBatchGrant}
              disabled={isLoading || isTransactionPending || !newWalletAddress.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading || isTransactionPending ? 'Processing...' : 'Batch Grant'}
            </button>
          </div>
        </div>
      </div>

      {/* Current Minter Addresses */}
      <div className="p-4 border rounded-lg">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Current Minter Addresses ({minterAddresses.length})</h3>
          <button
            onClick={loadMinterAddresses}
            className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
          >
            Refresh
          </button>
        </div>
        
        {minterAddresses.length === 0 ? (
          <p className="text-gray-500">No minter addresses found</p>
        ) : (
          <div className="space-y-2">
            {minterAddresses.map((address, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <code className="text-sm">{address}</code>
                <button
                  onClick={() => handleRevokeMinterRole(address)}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">How It Works</h3>
        <ul className="text-sm space-y-1">
          <li>• <strong>Automatic Mode:</strong> If admin private key is configured, roles are granted automatically</li>
          <li>• <strong>Manual Mode:</strong> If no admin key, transactions require approval in your wallet</li>
          <li>• <strong>Batch Processing:</strong> Enter multiple addresses (one per line) for bulk operations</li>
          <li>• <strong>NFT Minting:</strong> Users with MINTER_ROLE can mint NFTs directly from their wallets</li>
        </ul>
      </div>
    </div>
  );
};
