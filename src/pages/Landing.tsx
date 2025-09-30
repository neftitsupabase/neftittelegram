import React, { useState } from "react";
import "@/styles/fonts.css";
import WalletConnectionModal from "@/components/wallet/WalletConnectionModal";
import { NFTShowcase } from "@/components/showcase/NFTShowcase";
import { useWallet } from "@/components/wallet/WalletProvider";
import { MainNav } from "@/components/layout/MainNav";
import HeroSection from "@/components/ui/HeroSection";
import WhyChooseUsSection from "@/components/ui/WhyChooseUsSection";
import WhyUsersLoveSection from "@/components/ui/WhyusersLoveSection";
import HowItWorksSection from "@/components/ui/HowItWorksSection";
import StartJourneySection from "@/components/ui/StartJourneySection";


const Landing: React.FC = () => {
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const { isAuthenticated, isConnected } = useWallet();

  return (
    <div className="min-h-screen bg-[#02020e] font-sora relative overflow-hidden">

      <MainNav setExternalWalletModalOpen={setIsWalletModalOpen} />

      <main className=" pt-0 mt-0 py-0 space-y-0">

        {/* Hero Section - Full Width */}
        <HeroSection
          isAuthenticated={isAuthenticated}
          isConnected={isConnected}
          setIsWalletModalOpen={setIsWalletModalOpen}
        />

        {/* NFT Showcase Section */}
        <NFTShowcase />

        {/* Why Choose Us Section */}
        <WhyChooseUsSection />

        {/* Why Users Love Us Section */}
        <WhyUsersLoveSection />

        {/* How It Works Section */}
        <HowItWorksSection mascotSrc="/images/SliderGuy.png" />

        {/* Start Journey Section */}
        <StartJourneySection isAuthenticated={isAuthenticated}
          isConnected={isConnected}
          setIsWalletModalOpen={setIsWalletModalOpen} />


      </main>

      {/* Wallet Connection Modal */}
      <WalletConnectionModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />
    </div>
  );
};

export default Landing;
