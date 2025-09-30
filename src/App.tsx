import { Toaster } from "@/components/ui/toaster";
import { WalletProvider as SuiWalletProvider } from '@suiet/wallet-kit';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import ScrollToTop from "@/components/common/ScrollToTop";
import { WalletProvider, useWallet } from "./components/wallet/WalletProvider";
import { NFTProvider } from "./contexts/NFTContext";
import Index from "./pages/Index";
import Discover from "./pages/Discover";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Streaks from "./pages/Streaks";
import NotFound from "./pages/NotFound";
import ProjectDetails from "./pages/ProjectDetails";
import SavedNFTs from "./pages/SavedNFTs";
import Activity from "./pages/Activity";
import Settings from "./pages/Settings";
import BurnPage from "./pages/Burn";
import Landing from "./pages/Landing";
import Achievements from "./pages/Achievements";
import Leaderboard from "./pages/Leaderboard";
import HowItWorks from "./pages/HowItWorks";
import QuestRewardsNew from "./pages/QuestRewardsNew";
import AuthCallback from "./pages/AuthCallback";
import TelegramCallback from "./pages/auth/TelegramCallback";
import { useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import StakingPage from "./pages/Staking";
import ReferralInvite from "./pages/ReferralInvite";
import { ThirdwebProvider } from "./providers/ThirdwebProvider";

// import Docs routes
import DocsRoutes from "./pages/DocsRoutes";
import { DocsNavigationProvider } from "./contexts/DocsNavigationContext";

const queryClient = new QueryClient();

if (typeof window !== "undefined") {
  if (!localStorage.getItem("isAuthenticated")) {
    localStorage.setItem("isAuthenticated", "false");
  }
}

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isConnected } = useWallet();
  const localAuth = localStorage.getItem("isAuthenticated") === "true";
  const forceAuthCheck = localStorage.getItem("force_auth_check") === "true";
  const currentPath = window.location.pathname;

  // Special case: Allow staying on EditProfile page even when disconnected
  const isEditProfilePage = currentPath === "/edit-profile";

  // Auth logic: Allow access if authenticated OR if on EditProfile page
  const auth = (isAuthenticated || isConnected || localAuth || isEditProfilePage) && !forceAuthCheck;

  useEffect(() => {
    console.log("Auth state in PrivateRoute:", {
      isAuthenticated,
      isConnected,
      localAuth,
      forceAuthCheck,
      isEditProfilePage,
      auth
    });

    // Clean up the force check flag
    if (forceAuthCheck) {
      localStorage.removeItem("force_auth_check");
    }
  }, [auth, isAuthenticated, isConnected, localAuth, forceAuthCheck, isEditProfilePage]);

  return auth ? children : <Navigate to="/" />;
};

// Layout wrapper
const LayoutWrapper = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const noLayoutRoutes = ['/auth/callback', '/invite', '/docs'];

  const shouldSkipLayout = noLayoutRoutes.some(route =>
    location.pathname === route || location.pathname.startsWith(route + '/')
  );

  // For callback routes, render directly without MainLayout
  if (shouldSkipLayout) {
    return <>{children}</>;
  }

  // For all other routes, use MainLayout
  return <MainLayout>{children}</MainLayout>;
};

// Inject Sora font
const FontInjector = () => {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
      
      *, *::before, *::after, body, html, #root, div, p, h1, h2, h3, h4, h5, h6, 
      span, a, button, input, textarea, select, option {
        font-family: 'Sora', sans-serif !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return null;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThirdwebProvider>
        <SuiWalletProvider>
          <WalletProvider>
            <NFTProvider>
              <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <FontInjector />
                <ScrollToTop />
                <LayoutWrapper>
                  <Routes>
                    {/* Public pages */}
                    <Route path="/" element={<Landing />} />
                    {/* <Route path="/auth" element={<AuthPage />} /> */}
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/auth/telegram-callback" element={<TelegramCallback />} />
                    <Route path="/invite/:referralCode" element={<ReferralInvite />} />
                    <Route path="/discover" element={<Discover />} />
                    <Route path="/discover/:id" element={<ProjectDetails />} />
                    <Route path="/how-it-works" element={<HowItWorks />} />
                    <Route path="/quests" element={<QuestRewardsNew />} />

                    {/* Protected pages */}
                    <Route path="/home" element={<PrivateRoute><Index /></PrivateRoute>} />
                    <Route path="/burn" element={<PrivateRoute><BurnPage /></PrivateRoute>} />
                    <Route path="/staking" element={<PrivateRoute><StakingPage /></PrivateRoute>} />
                    {/* <Route path="/project/:id" element={<PrivateRoute><ProjectDetails /></PrivateRoute>} /> */}
                    <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                    <Route path="/edit-profile" element={<PrivateRoute><EditProfile /></PrivateRoute>} />
                    <Route path="/streaks" element={<PrivateRoute><Streaks /></PrivateRoute>} />
                    <Route path="/saved" element={<PrivateRoute><SavedNFTs /></PrivateRoute>} />
                    <Route path="/leaderboard" element={<PrivateRoute><Leaderboard /></PrivateRoute>} />
                    <Route path="/activity" element={<PrivateRoute><Activity /></PrivateRoute>} />
                    <Route path="/achievements" element={<PrivateRoute><Achievements /></PrivateRoute>} />

                    {/* Docs system */}
                    <Route
                      path="/docs/*"
                      element={
                        <DocsNavigationProvider>
                          <DocsRoutes />
                        </DocsNavigationProvider>
                      }
                    />

                    {/* Fallback */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </LayoutWrapper>
              </BrowserRouter>
              </TooltipProvider>
            </NFTProvider>
          </WalletProvider>
        </SuiWalletProvider >
      </ThirdwebProvider>
    </QueryClientProvider>
  );
};

export default App;
