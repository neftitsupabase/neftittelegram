/**
 * Authentication utilities for handling auth state and token management
 */

// Authentication status
export const getAuthStatus = (): boolean => 
  localStorage.getItem("isAuthenticated") === "true";

export const setAuthStatus = (status: boolean): void => 
  localStorage.setItem("isAuthenticated", status.toString());

// Wallet address
export const getWalletAddress = (): string | null => 
  localStorage.getItem("walletAddress") || localStorage.getItem("userAddress");

export const setWalletAddress = (address: string): void => 
  localStorage.setItem("walletAddress", address);

// Wallet type
export const getWalletType = (): string | null => 
  localStorage.getItem("walletType");

export const setWalletType = (type: string): void => 
  localStorage.setItem("walletType", type);

// Token management
export const saveToken = (token: string): void => {
  sessionStorage.setItem('auth_token', token);
  // Set token expiry
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  sessionStorage.setItem('token_expiry', expiry.toISOString());
};

export const getToken = (): string | null => 
  sessionStorage.getItem('auth_token');

export const isTokenValid = (): boolean => {
  const expiryStr = sessionStorage.getItem('token_expiry');
  if (!expiryStr) return false;
  
  const expiry = new Date(expiryStr);
  return new Date() < expiry;
};

// Session management
export const clearAuthSession = (): void => {
  // Clear all localStorage items
  localStorage.removeItem("walletAddress");
  localStorage.removeItem("userAddress");
  localStorage.removeItem("isAuthenticated");
  localStorage.removeItem("walletType");
  localStorage.removeItem("walletBalance");
  localStorage.removeItem("stakedAmount");
  localStorage.removeItem("walletConnectConnected");
  localStorage.removeItem("lastAuthPayload");
  localStorage.removeItem("lastAuthError");
  localStorage.removeItem("socialProvider");
  
  // Clear sessionStorage items
  sessionStorage.removeItem("walletAddress");
  sessionStorage.removeItem("username");
  sessionStorage.removeItem("avatar");
  sessionStorage.removeItem("auth_token");
  sessionStorage.removeItem("token_expiry");
  
  // Dispatch event for components to react
  window.dispatchEvent(new CustomEvent('auth-status-changed'));
};

// Helper for wallet address formatting
/**
 * Formats a wallet address for display by truncating the middle section
 * 
 * @param address The wallet address to format
 * @param prefixLength Number of characters to show at the start (default: 6)
 * @param suffixLength Number of characters to show at the end (default: 4)
 * @returns The formatted address with prefix...suffix format
 */
export const formatWalletAddress = (
  address: string, 
  prefixLength = 6, 
  suffixLength = 4
): string => {
  if (!address) return '';
  
  // If address is shorter than combined prefix+suffix, return full address
  if (address.length <= prefixLength + suffixLength) {
    return address;
  }
  
  const prefix = address.substring(0, prefixLength);
  const suffix = address.substring(address.length - suffixLength);
  return `${prefix}...${suffix}`;
};

// Social login tracking
export const trackSocialLogin = (provider: string): void => {
  localStorage.setItem("lastAuthMethod", "social");
  localStorage.setItem("socialProvider", provider);
  localStorage.setItem("walletType", "social");
};

// Check if user is social login
export const isSocialLogin = (): boolean => {
  return localStorage.getItem("walletType") === "social" && 
         !!localStorage.getItem("socialProvider");
}; 