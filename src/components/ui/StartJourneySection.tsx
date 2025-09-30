import { BorderBeam } from "@/components/magicui/borderBeam";
import ScrollPlane from "@/components/ui/ScrollPlane";
import { Link } from "react-router-dom";

interface StartJourneySectionProps {
  isAuthenticated: boolean;
  isConnected: boolean;
  setIsWalletModalOpen: (open: boolean) => void;
}

const StartJourneySection = ({ isAuthenticated, isConnected, setIsWalletModalOpen }: StartJourneySectionProps) => {

  return (
    <section className="relative bg-[#0b0a14] overflow-visible p-10 lg:h-[1000px]">
      {/* Scroll Plane Animation - takes its natural space */}
      <ScrollPlane
        variant="inline"
        pin={false}
        side="left"
        raiseOnEnd={false}
        className="hidden lg:block z-0 pointer-events-none"
        planeClassName="w-40 h-40 lg:w-40 lg:h-40"
      />

      {/* Start Journey Section - positioned with proper spacing */}

      <div className="relative z-10 glass-card overflow-hidden text-center lg:mt-[155px] p-8 w-full max-w-3xl mx-auto rounded-xl transition-none hover:scale-100 hover:shadow-none">
        {!isAuthenticated && !isConnected ? (
          <>
            <h2 className="text-2xl lg:text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-[#5d43ef] to-[#8680c4]">
              Start Your NFT Journey Today
            </h2>
            <p className="text-[#94A3B8] text-sm lg:text-base mb-6">
              Engage. Collect. Upgrade. Be Part of the Future of NFTs!
            </p>
            <button onClick={() => setIsWalletModalOpen(true)} className="px-8 text-sm lg:text-base py-1 rounded-md bg-gradient-to-r from-[#5d43ef] to-[#8a79ec] text-white hover:bg-gradient-to-r hover:from-[#6d53ff] hover:to-[#1e1b47] transition-all duration-300 transform hover:-translate-y-1">
              Join Now
            </button> </>) : (
          <>
            <h2 className="text-2xl lg:text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-[#5d43ef] to-[#8680c4]">
              Welcome back to NEFTIT
            </h2>
            <p className="text-[#94A3B8] text-sm lg:text-base mb-6">
              Engage. Collect. Upgrade. Be Part of the Future of NFTs!
            </p>
            <Link to="/discover">
              <button className="px-8 text-sm lg:text-base py-1 rounded-md bg-gradient-to-r from-[#5d43ef] to-[#8a79ec] text-white hover:bg-gradient-to-r hover:from-[#6d53ff] hover:to-[#1e1b47] transition-all duration-300 transform hover:-translate-y-1">
                Continue Collecting
              </button>
            </Link>
          </>
        )}
        {/* BorderBeam effects */}
        <BorderBeam
          duration={6}
          size={300}
          className="from-transparent via-[#ffffff] to-transparent"
        />
        <BorderBeam
          duration={6}
          delay={3}
          size={300}
          borderWidth={2}
          className="from-transparent via-blue-500 to-transparent"
          reverse
          initialOffset={50}
        />
      </div>


    </section>
  );
};

export default StartJourneySection;

