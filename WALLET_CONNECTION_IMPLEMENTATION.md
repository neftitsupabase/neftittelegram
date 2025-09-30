# Wallet Connection Implementation Guide

## Overview
This implementation allows users to connect multiple wallet types (MetaMask, Phantom, etc.) to their existing account in the Edit Profile page without creating new users. The system maintains all connections in the database and shows the correct connection status for each provider.

## Features Implemented

### 1. **Multi-Wallet Support**
- **MetaMask**: EVM-compatible wallet connection
- **Phantom**: Solana wallet connection  
- **WalletConnect**: Placeholder for future implementation
- **Coinbase Wallet**: Placeholder for future implementation

### 2. **Connection Management**
- Connect additional wallets to existing accounts
- Disconnect non-primary wallets
- View connection status for all providers
- Persistent storage in Supabase database

### 3. **Database Integration**
- Uses existing `add_wallet_connection` RPC function
- Stores wallet addresses and types in `linked_wallet_addresses` JSONB field
- Updates `connection_history` with wallet connection events
- No duplicate user creation

## How It Works

### **Connection Flow**
1. **User clicks "Connect"** on a wallet provider in Edit Profile
2. **`useConnectProvider` hook** handles the connection
3. **Wallet-specific connection logic** executes (MetaMask/Phantom)
4. **Wallet address retrieved** from the connected wallet
5. **Database update** via `addWalletConnection` RPC function
6. **UI refresh** to show new connection status
7. **Success notification** displayed to user

### **Database Schema**
```sql
-- Wallet connections are stored in:
linked_wallet_addresses: [
  {
    "address": "0x1234...",
    "wallet_type": "metamask",
    "connected_at": "2025-08-12T09:47:15.000000+00:00",
    "is_primary": false
  },
  {
    "address": "ABC123...",
    "wallet_type": "phantom", 
    "connected_at": "2025-08-12T09:47:20.000000+00:00",
    "is_primary": false
  }
]

-- Connection history tracks all events:
connection_history: [
  {
    "action": "wallet_connected",
    "wallet_type": "metamask",
    "address": "0x1234...",
    "timestamp": "2025-08-12T09:47:15.000000+00:00"
  },
  {
    "action": "wallet_connected", 
    "wallet_type": "phantom",
    "address": "ABC123...",
    "timestamp": "2025-08-12T09:47:20.000000+00:00"
  }
]
```

## Implementation Details

### **1. Updated useConnectProvider Hook**
- **`connectWalletProvider()`**: Main entry point for wallet connections
- **`connectMetaMask()`**: Handles MetaMask connection flow
- **`connectPhantom()`**: Handles Phantom connection flow
- **State management**: Tracks connection status for each provider
- **Error handling**: Comprehensive error handling with user feedback

### **2. Enhanced EditProfile Component**
- **Connection status detection**: Shows connected/disconnected state for all providers
- **Event listeners**: Listens for wallet connection/disconnection events
- **Real-time updates**: Refreshes connection data when wallets are connected
- **Provider management**: Handles both social and wallet connections

### **3. Database Functions**
- **`add_wallet_connection`**: Adds new wallet to existing user
- **`get_user_connections`**: Retrieves all user connections
- **`remove_wallet_connection`**: Removes wallet connections
- **`connection_exists`**: Checks if connection already exists

## Usage Instructions

### **For Users**
1. **Navigate to Edit Profile** page
2. **Click "Connect"** on desired wallet provider
3. **Approve connection** in wallet popup
4. **View connection status** - shows "Connected" with green ring
5. **Disconnect if needed** (non-primary wallets only)

### **For Developers**
1. **Import the hook**: `import { useConnectProvider } from '@/hooks/useConnectProvider'`
2. **Configure options**: Set mode to 'additional' for existing users
3. **Handle connections**: Use `connectWalletProvider(walletType)`
4. **Listen for events**: Handle `wallet-connected-additional` events

## Expected Output

After connecting MetaMask and Phantom, your `connection_history` should look like:

```json
[
  {
    "action": "social_connected",
    "provider": "twitter",
    "timestamp": "2025-08-12T09:46:26.924131+00:00"
  },
  {
    "action": "social_connected", 
    "provider": "discord",
    "timestamp": "2025-08-12T09:46:50.266353+00:00"
  },
  {
    "action": "social_connected",
    "provider": "google", 
    "timestamp": "2025-08-12T09:47:00.293569+00:00"
  },
  {
    "action": "wallet_connected",
    "wallet_type": "metamask",
    "address": "0x1234...",
    "timestamp": "2025-08-12T09:47:15.000000+00:00"
  },
  {
    "action": "wallet_connected",
    "wallet_type": "phantom", 
    "address": "ABC123...",
    "timestamp": "2025-08-12T09:47:20.000000+00:00"
  }
]
```

## Testing

### **Manual Testing**
1. **Install MetaMask** browser extension
2. **Install Phantom** browser extension  
3. **Login with Google** to create account
4. **Navigate to Edit Profile**
5. **Connect MetaMask** - should show connected status
6. **Connect Phantom** - should show connected status
7. **Check database** - verify connections are stored

### **Console Testing**
```javascript
// Test MetaMask connection
import { testWalletConnections } from '@/utils/testWalletConnections';
await testWalletConnections.testConnectionFlow('metamask');

// Test Phantom connection  
await testWalletConnections.testConnectionFlow('phantom');
```

## Troubleshooting

### **Common Issues**
1. **"MetaMask not installed"**: Install MetaMask browser extension
2. **"Phantom not installed"**: Install Phantom browser extension
3. **Connection fails**: Check browser console for detailed errors
4. **UI not updating**: Refresh page or check event listeners

### **Debug Steps**
1. **Check browser console** for connection logs
2. **Verify wallet installation** and browser permissions
3. **Check database** for connection records
4. **Test with different wallets** to isolate issues

## Future Enhancements

### **Planned Features**
- **WalletConnect v2** integration
- **Coinbase Wallet** support
- **Multi-chain wallet** detection
- **Wallet balance** display
- **Transaction history** integration

### **Code Improvements**
- **Better error handling** for network issues
- **Connection retry logic** for failed attempts
- **Wallet state persistence** across sessions
- **Performance optimization** for multiple connections

## Security Considerations

### **Data Protection**
- **Wallet addresses** are stored securely in database
- **No private keys** are ever stored or transmitted
- **Connection validation** prevents duplicate connections
- **User authentication** required for all operations

### **Access Control**
- **Primary connections** cannot be removed
- **User verification** before adding connections
- **Session management** for connection operations
- **Audit trail** via connection history

## Conclusion

This implementation provides a robust, user-friendly way to connect multiple wallets to existing accounts. It maintains data integrity, provides real-time feedback, and integrates seamlessly with the existing authentication system. Users can now manage all their wallet connections from a single interface while maintaining their primary login method.

