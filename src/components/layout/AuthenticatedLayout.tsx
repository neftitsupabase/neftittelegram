import React from 'react';
import { RequireAuth } from '@/components/auth/AuthProtection';
import { MainNav } from '@/components/layout/MainNav';
import Sidebar from '@/components/profile/Sidebar';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
        <MainNav />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6 ml-20 md:ml-64">
            {children}
          </main>
        </div>
      </div>
    </RequireAuth>
  );
} 