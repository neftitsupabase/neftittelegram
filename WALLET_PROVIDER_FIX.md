# WalletProvider Authentication Fix

The WalletProvider.tsx file has some issues with orphaned code. Here's the key fix needed:

## Replace the `authenticateWithBackend` function

Replace this function (around line 514) with:

```typescript
// Helper function to authenticate with backend using unified system
const authenticateWithBackend = async (walletAddress: string, providerType: WalletType | string) => {
  try {
    console.log(`Authenticating wallet ${walletAddress} with provider ${providerType} using unified system`);
    
    // Determine wallet type name
    let walletTypeName = typeof providerType === "string" ? providerType : providerType;
    if (walletTypeName === "evm") {
      walletTypeName = "metamask"; // Default EVM to MetaMask
    }
    
    // Use unified wallet authentication system
    const { processWalletLogin } = await import('@/api/walletAuth');
    const authResult = await processWalletLogin(walletAddress, walletTypeName, {
      provider_type: providerType
    });
    
    if (!authResult.success) {
      throw new Error(authResult.error || 'Wallet authentication failed');
    }
    
    if (authResult.isNewUser) {
      console.log('🎉 New user created successfully');
      toast.success(`Welcome! Your ${walletTypeName} wallet account has been created.`);
    } else {
      console.log('👋 Existing user logged in successfully');
      toast.success(`Welcome back! Logged in with ${walletTypeName}.`);
    }
    
    // Redirect to discover page
    window.location.replace("/discover");
    
  } catch (error: any) {
    console.error("Wallet authentication error:", error);
    toast.error(`Failed to authenticate wallet: ${error.message}`);
    
    // Set authentication failed status
    setWalletConnectionStatus({ 
      status: "error", 
      message: "Authentication failed",
      error: error.message
    });
    
    // Reset connection state
    setConnecting(false);
    setIsConnected(false);
    setAddress(null);
    
    throw error;
  }
};
```

## Remove Orphaned Code

Remove any orphaned code between the function definitions (there's some leftover code that needs to be cleaned up).

This fix ensures all wallet types (MetaMask, Phantom, WalletConnect, Sui) use the unified authentication system that maintains single UUIDs per user.
