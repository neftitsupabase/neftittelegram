# NFT Minter Permission System Setup Guide

## Overview
This system allows all user wallet addresses to mint NFTs by automatically granting MINTER_ROLE permissions. The integration includes:

1. **ContractPermissionService** - Manages role checking and transaction preparation
2. **AdminMinterService** - Handles automatic role granting with admin privileges
3. **Web3MetaMaskNFTService** - Updated to automatically grant permissions during minting
4. **MinterPermissionManager** - React component for managing permissions

## Environment Variables Setup

Add these variables to your `.env` file:

```bash
# Required: Your Thirdweb Client ID
VITE_THIRDWEB_CLIENT_ID=your_thirdweb_client_id

# Required: NFT Contract Address (already configured)
VITE_NFT_CLAIM_CONTRACT_ADDRESS=0x5Bb23220cC12585264fCd144C448eF222c8572A2

# Optional: Admin Private Key for Automatic Role Granting
VITE_ADMIN_PRIVATE_KEY=your_admin_wallet_private_key_here
```

## Admin Private Key Setup (Optional but Recommended)

### Option 1: Automatic Role Granting (Recommended)
1. Create a dedicated admin wallet with sufficient MATIC balance
2. Grant this wallet DEFAULT_ADMIN_ROLE on your contract
3. Add the private key to `VITE_ADMIN_PRIVATE_KEY`
4. Users will automatically receive MINTER_ROLE when they try to mint

### Option 2: Manual Role Granting
1. Don't set `VITE_ADMIN_PRIVATE_KEY`
2. Use the MinterPermissionManager component to manually grant roles
3. Each role grant requires wallet approval from an admin

## How It Works

### Automatic Minting Flow
```typescript
// When user calls mintNFT():
1. Check if user has MINTER_ROLE
2. If not, automatically grant MINTER_ROLE using AdminMinterService
3. Proceed with NFT minting
4. User can mint without manual permission setup
```

### Permission Management
```typescript
// Grant role to single user
const result = await adminMinterService.grantMinterRoleToUser(walletAddress);

// Batch grant to multiple users
const result = await adminMinterService.batchGrantMinterRole([address1, address2]);

// Check admin status
const status = await adminMinterService.getAdminStatus();
```

## Integration Examples

### Basic NFT Minting (Already Integrated)
```typescript
import { web3MetaMaskNFTService } from './services/Web3MetaMaskNFTService';

// This now automatically handles MINTER_ROLE granting
const result = await web3MetaMaskNFTService.mintNFT(nftId, walletAddress);
```

### Manual Permission Management Component
```tsx
import { MinterPermissionManager } from './components/admin/MinterPermissionManager';

function AdminPanel() {
  return (
    <div>
      <h1>Admin Panel</h1>
      <MinterPermissionManager />
    </div>
  );
}
```

### Custom Permission Granting
```typescript
import { adminMinterService } from './services/AdminMinterService';

async function grantPermissionToUser(userWallet: string) {
  const result = await adminMinterService.grantMinterRoleToUser(userWallet);
  
  if (result.success) {
    console.log('Permission granted:', result.txHash);
  } else {
    console.error('Failed:', result.message);
  }
}
```

## Contract Setup Requirements

Your NFT contract must have:
1. **AccessControl** functionality (already implemented)
2. **MINTER_ROLE** defined (already implemented)
3. **mintTo()** function restricted to MINTER_ROLE (already implemented)

## Testing the Integration

### 1. Test Admin Status
```typescript
const status = await adminMinterService.getAdminStatus();
console.log('Admin configured:', status.hasAdminAccount);
console.log('Has admin role:', status.hasAdminRole);
```

### 2. Test Permission Granting
```typescript
const result = await adminMinterService.grantMinterRoleToUser('0x...');
console.log('Grant successful:', result.success);
```

### 3. Test NFT Minting
```typescript
// This should now work for any user wallet
const mintResult = await web3MetaMaskNFTService.mintNFT(nftId, userWallet);
console.log('Mint successful:', mintResult.success);
```

## Security Considerations

1. **Private Key Security**: Store admin private key securely, never commit to version control
2. **Admin Role Management**: Only grant DEFAULT_ADMIN_ROLE to trusted wallets
3. **MINTER_ROLE Scope**: MINTER_ROLE only allows minting, not other admin functions
4. **Gas Costs**: Admin wallet needs MATIC for automatic role granting transactions

## Troubleshooting

### "Admin account not configured"
- Add `VITE_ADMIN_PRIVATE_KEY` to your `.env` file
- Ensure the admin wallet has DEFAULT_ADMIN_ROLE on the contract

### "Admin account does not have permission"
- Grant DEFAULT_ADMIN_ROLE to your admin wallet address
- Use existing contract owner to grant admin role

### "Insufficient MATIC balance"
- Add MATIC to your admin wallet
- Each role grant costs ~0.001-0.01 MATIC

### "Transaction failed"
- Check network connection (Polygon Amoy testnet)
- Verify contract address is correct
- Ensure wallet is connected to correct network

## Production Deployment

1. Set up dedicated admin wallet with sufficient MATIC
2. Configure environment variables on your hosting platform
3. Test permission granting on testnet first
4. Monitor admin wallet balance and transaction costs
5. Consider implementing role revocation for security

## API Reference

### AdminMinterService Methods
- `grantMinterRoleToUser(address)` - Grant role to single user
- `batchGrantMinterRole(addresses)` - Grant role to multiple users
- `getAdminStatus()` - Check admin configuration
- `getAllMinterAddresses()` - Get all addresses with MINTER_ROLE

### ContractPermissionService Methods
- `hasMinterRole(address)` - Check if address has MINTER_ROLE
- `hasAdminRole(address)` - Check if address has admin role
- `prepareGrantMinterRole(address)` - Prepare grant transaction
- `prepareRevokeMinterRole(address)` - Prepare revoke transaction

This system now allows any user wallet to mint NFTs with automatic permission management!
