import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface DocsNavigationContextType {
  handleDocsNavigation: (path: string) => void;
  isInternalNavigation: boolean;
  markInternalNavigation: () => void;
  resetNavigationState: () => void;
}

const DocsNavigationContext = createContext<DocsNavigationContextType | undefined>(undefined);

export const useDocsNavigation = () => {
  const context = useContext(DocsNavigationContext);
  if (!context) {
    throw new Error('useDocsNavigation must be used within a DocsNavigationProvider');
  }
  return context;
};

interface DocsNavigationProviderProps {
  children: ReactNode;
}

export const DocsNavigationProvider: React.FC<DocsNavigationProviderProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isInternalNavigation, setIsInternalNavigation] = useState(false);
  const [docsEntryPath, setDocsEntryPath] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);

  // Initialize the navigation state
  useEffect(() => {
    if (!hasInitializedRef.current && location.pathname.startsWith('/docs')) {
      // This is the first time we're entering docs
      hasInitializedRef.current = true;
      setIsInternalNavigation(false);
    }
  }, [location.pathname]);

  // Reset navigation state when leaving docs
  useEffect(() => {
    if (!location.pathname.startsWith('/docs')) {
      setIsInternalNavigation(false);
      setDocsEntryPath(null);
      hasInitializedRef.current = false;
    }
  }, [location.pathname]);

  const handleDocsNavigation = (path: string) => {
    if (!location.pathname.startsWith('/docs')) {
      // We're entering docs for the first time from outside
      setDocsEntryPath(location.pathname);
      setIsInternalNavigation(false);
      hasInitializedRef.current = true;
      
      // If navigating to /docs, go directly to overview with replace
      if (path === '/docs' || path === '/docs/') {
        navigate('/docs/overview', { replace: true });
      } else {
        // When entering docs and going to a specific page, use replace to avoid extra history
        navigate(path, { replace: true });
      }
    } else {
      // We're already in docs - always use replace for any navigation within docs
      navigate(path, { replace: true });
    }
  };

  const markInternalNavigation = () => {
    setIsInternalNavigation(true);
  };

  const resetNavigationState = () => {
    setIsInternalNavigation(false);
    setDocsEntryPath(null);
    hasInitializedRef.current = false;
  };

  return (
    <DocsNavigationContext.Provider
      value={{
        handleDocsNavigation,
        isInternalNavigation,
        markInternalNavigation,
        resetNavigationState,
      }}
    >
      {children}
    </DocsNavigationContext.Provider>
  );
};
