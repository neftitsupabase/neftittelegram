import { useLocation } from 'react-router-dom';
import { MainNav } from "@/components/layout/MainNav";
import { MainFooter } from "@/components/shared/MainFooter";
import { useWallet } from "@/components/wallet/WalletProvider";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const { isConnected } = useWallet();
  const isLandingPage = location.pathname === '/';
  
  // Only show MainNav on pages that aren't the landing page
  const showMainNav = !isLandingPage;
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Show MainNav if not on landing page */}
      {showMainNav && <MainNav />}
      
      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <MainFooter />
    </div>
  );
}
