import React, { useEffect, useState, useCallback, memo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

// Utility functions for authentication
const getAuthStatus = () => localStorage.getItem("isAuthenticated") === "true";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const RequireAuth = memo(({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  // Use useCallback for functions that are passed as dependencies
  const checkAuthStatus = useCallback(() => {
    const authStatus = getAuthStatus();
    setIsAuthenticated(authStatus);
    
    if (!authStatus) {
      console.log("User not authenticated, redirecting to home page");
      toast.error("Please connect your wallet or sign in to access this page");
    }
  }, []);
  
  useEffect(() => {
    checkAuthStatus();
    
    // Listen for auth changes
    const handleAuthChange = () => checkAuthStatus();
    window.addEventListener('auth-status-changed', handleAuthChange);
    
    return () => {
      window.removeEventListener('auth-status-changed', handleAuthChange);
    };
  }, [checkAuthStatus]);
  
  // Show nothing while checking authentication status
  if (isAuthenticated === null) {
    return null;
  }
  
  // If not authenticated, redirect to home page
  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  
  // If authenticated, render the protected route
  return <>{children}</>;
});

RequireAuth.displayName = 'RequireAuth';

export const RequireNoAuth = memo(({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [redirectPath, setRedirectPath] = useState<string>("/discover");
  
  // Use useCallback for functions that are passed as dependencies
  const checkAuthAndRedirect = useCallback(() => {
    // Check authentication status
    const authStatus = getAuthStatus();
    setIsAuthenticated(authStatus);
    
    // Get the intended destination after login from query params if it exists
    const params = new URLSearchParams(location.search);
    const redirectTo = params.get("redirectTo");
    if (redirectTo) {
      setRedirectPath(redirectTo);
    }
    
    if (authStatus) {
      console.log("User already authenticated, redirecting to discover page");
    }
  }, [location.search]);
  
  useEffect(() => {
    checkAuthAndRedirect();
    
    // Listen for auth changes
    const handleAuthChange = () => checkAuthAndRedirect();
    window.addEventListener('auth-status-changed', handleAuthChange);
    
    return () => {
      window.removeEventListener('auth-status-changed', handleAuthChange);
    };
  }, [checkAuthAndRedirect]);
  
  // Show nothing while checking authentication status
  if (isAuthenticated === null) {
    return null;
  }
  
  // If already authenticated, redirect to discover page
  if (isAuthenticated) {
    return <Navigate to={redirectPath} replace />;
  }
  
  // If not authenticated, render the public route
  return <>{children}</>;
});

RequireNoAuth.displayName = 'RequireNoAuth'; 