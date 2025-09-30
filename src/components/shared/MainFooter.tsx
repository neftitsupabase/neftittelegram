import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export function MainFooter() {
  return (
    <footer className="relative bg-[#0b0a14] border border-[#0b0a14] backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          {/* Brand Section */}
          <div className="md:col-span-4">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tighter text-white text-left">NEFTIT</h2>
              <p className="text-sm text-gray-400 sm:max-w-xs text-left">
                NEFTIT is a Web3 engagement platform designed to empower NFT projects and communities through gamified interactions.
              </p>
            </div>
          </div>

          {/* Newsletter Section */}
          {/* <div className="md:col-span-5 flex flex-col gap-2">
            <h3 className="text-md sm:text-lg font-semibold text-white">
              GET NEFTIT UPDATES IN YOUR INBOX
            </h3>
            <div className="flex flex-col items-center sm:flex-row sm:items-stretch gap-2 w-full">
              <Input
                type="email"
                placeholder="Your email..."
                className="bg-[#1b1930] border-[#5D43EF]/10 text-white placeholder:text-gray-500 rounder rounded-2xl focus-visible:ring-[#5d43ef] w-full"
              />
              <Button
                variant="outline"
                className="border-[#5D43EF] text-[#5D43EF] rounded-2xl hover:bg-[#5D43EF]/10 w-1/2 sm:w-auto"
              >
                SUBMIT
              </Button>
            </div>
          </div> */}

            <div className="md:col-span-4 flex flex-col items-start sm:items-center gap-2">
            <h3 className="text-lg font-semibold text-white mb-2">SUPPORT/LEGAL</h3>
              <Link to="/docs/overview" className="text-sm text-gray-400 hover:text-[#5D43EF] transition-colors">
                Docs
              </Link>
              <Link to="/docs/appendix/media-kit" className="text-sm text-gray-400 hover:text-[#5D43EF] transition-colors">
                Media Kit
              </Link>
              <Link to="/docs/legal-compliance-risk/privacy-policy" className="text-sm text-gray-400 hover:text-[#5D43EF] transition-colors">
                Privacy Policy
              </Link>
              <Link to="/docs/legal-compliance-risk/terms-of-service" className="text-sm text-gray-400 hover:text-[#5D43EF] transition-colors">
                Terms of Service
              </Link>
            </div>

          {/* Social Links */}
          <div className="md:col-span-4 flex flex-col items-start sm:items-center gap-2">
            <h3 className="text-lg font-semibold text-white mb-2">SOCIAL</h3>
            <div className="space-y-2">
              <a
                href="#"
                className="flex items-center text-gray-400 hover:text-[#5D43EF] transition-colors"
              >
                <span className="text-sm mr-2">TWITTER</span>
                <ArrowUpRight size={14} />
              </a>
              <a
                href="#"
                className="flex items-center text-gray-400 hover:text-[#5D43EF] transition-colors"
              >
                <span className="text-sm mr-2">DISCORD</span>
                <ArrowUpRight size={14} />
              </a>
              <a
                href="#"
                className="flex items-center text-gray-400 hover:text-[#5D43EF] transition-colors"
              >
                <span className="text-sm mr-2">TELEGRAM</span>
                <ArrowUpRight size={14} />
              </a>
              <a
                href="#"
                className="flex items-center text-gray-400 hover:text-[#5D43EF] transition-colors"
              >
                <span className="text-sm mr-2">LINKEDIN</span>
                <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-[#2b284b]">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-400">
              © {new Date().getFullYear()} NEFTIT
            </div>
            
          </div>
        </div>
      </div>
      <div className="w-full flex justify-center">
        <img src="/images/neftitFont.png" alt="NEFTIT" className="opacity-70" />
      </div>
    </footer>
  );
}
