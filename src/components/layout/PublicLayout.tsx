import React from 'react';
import { RequireNoAuth } from '@/components/auth/AuthProtection';

interface PublicLayoutProps {
  children: React.ReactNode;
  requireNoAuth?: boolean;
}

export default function PublicLayout({ children, requireNoAuth = true }: PublicLayoutProps) {
  // If requireNoAuth is true, wrap the content in RequireNoAuth
  if (requireNoAuth) {
    return (
      <RequireNoAuth>
        <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
          {children}
        </div>
      </RequireNoAuth>
    );
  }
  
  // Otherwise, just return the content (for pages that can be accessed regardless of auth state)
  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      {children}
    </div>
  );
} 