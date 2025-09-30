import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface HeroSectionProps {
  isAuthenticated: boolean;
  isConnected: boolean;
  setIsWalletModalOpen: (open: boolean) => void;
}

export default function HeroSection({ isAuthenticated, isConnected, setIsWalletModalOpen }: HeroSectionProps) {
  return (
    <div>
      <section className="relative w-full bg-[url('/images/WebsiteCover2.5(Mobile).jpg')] md:bg-[url('/images/LandingPageImage.jpeg')] bg-cover bg-center bg-no-repeat min-h-[100vh] flex flex-col justify-between">
        {/* Coin 1 - Hidden on mobile, visible on tablet and desktop */}
        <div className="absolute top-[90px] left-[0px] w-8 h-8 hidden sm:block md:w-6 md:h-6 lg:w-8 lg:h-8">
          <img src="images/NEFTITCoin1.png" className="w-full h-full animate-float" />
        </div>
        {/* Coin 2 - Hidden on mobile, visible on tablet and desktop */}
        <div className="absolute top-[480px] right-[300px] w-12 h-12 hidden sm:block md:w-8 md:h-8 lg:w-12 lg:h-12">
          <img src="images/NEFTITCoin1.png" className="w-full h-full animate-float" />
        </div>
        {/* Coin 3 - Visible on all screens */}
        <div className="absolute top-[400px] left-[150px] w-6 h-6 sm:w-6 sm:h-6 md:w-8 md:h-8 lg:w-10 lg:h-10">
          <img src="images/NEFTITCoin3.png" className="w-full h-full animate-float" />
        </div>
        {/* Coin 4 - Visible on all screens */}
        <div className="absolute top-[320px] right-[0px] w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-8 lg:h-8">
          <img src="images/NEFTITCoin3.png" className="w-full h-full animate-float" />
        </div>
        {/* Coin 5 - Hidden on mobile, visible on tablet and desktop */}
        <div className="absolute top-[520px] right-[590px] w-20 h-20 hidden sm:block md:w-12 md:h-12 lg:w-20 lg:h-20">
          <img src="images/NEFTITCoin3.png" className="w-full h-full animate-float" />
        </div>
        {/* Coin 6 - Hidden on mobile and tablet, visible on desktop only */}
        <div className="absolute top-[380px] left-[30px] lg:top-[580px] lg:left-[710px] w-12 h-12 sm:w-12 sm:h-12 md:hidden lg:block lg:w-20 lg:h-20">
          <img src="images/NEFTITCoin1.png" className="w-full h-full animate-float" />
        </div>
        {/* Coin 7 - Hidden on mobile and tablet, visible on desktop only */}
        <div className="absolute top-[400px] right-[30px] lg:top-[480px] lg:left-[520px] w-6 h-6 sm:w-6 sm:h-6 md:hidden lg:w-12 lg:h-12">
          <img src="images/NEFTITCoin1.png" className="w-full h-full animate-float" />
        </div>
        <div className="container px-4 mx-auto flex-1 flex items-start mt-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="animate-fade-up mt-6 sm:mt-12">
              <h1 className="text-2xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-6 font-sora bg-clip-text text-transparent bg-gradient-to-r from-[#36F9F6] to-[#8B5CF6]">
                Collect, Upgrade & <span className="text-[#5d43ef]"> Earn Rewards</span>
              </h1>

              <p className="hidden sm:block text-sm sm:text-sm md:text-base lg:text-md text-[#94A3B8] max-w-2xl mx-auto mb-8 font-sora">
                Join the next generation of NFT collectors. Complete engaging
                quests, earn unique NFTs, and build your digital portfolio.
              </p>
            </div>
          </div>
        </div>

        {/* Buttons at the bottom */}
        <div className="container px-4 mx-auto pb-8">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {!isAuthenticated && !isConnected ? (
              <Button
                onClick={() => setIsWalletModalOpen(true)}
                className="glass-card bg-[#5d43ef]/20 hover:bg-[#5d43ef]/30 text-white font-sora px-4 py-2 text-sm sm:px-6 sm:py-2 sm:text-base md:px-8 md:py-3 md:text-lg transform hover:-translate-y-1 transition-all duration-300 border border-[#38B2AC]/30"
              >
                Start Collecting
              </Button>
            ) : (
              <Link to="/discover">
                <Button className="glass-card bg-[#5d43ef]/20 hover:bg-[#5d43ef]/30 text-white font-sora px-4 py-2 text-sm sm:px-6 sm:py-2 sm:text-base md:px-8 md:py-3 md:text-lg transform hover:-translate-y-1 transition-all duration-300 border border-[#38B2AC]/30">
                  Continue Collecting
                </Button>
              </Link>
            )}
            <Link to="/discover">
              <Button
                variant="outline"
                className=" bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] rounded-xl hover:bg-white/5 text-white font-sora px-4 py-2 text-sm sm:px-6 sm:py-2 sm:text-base md:px-8 md:py-3 md:text-lg border-[#2D3748] transform hover:-translate-y-1 transition-all duration-300"
              >
                Explore More
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}