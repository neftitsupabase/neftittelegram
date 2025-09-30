import React, { useEffect, useState } from 'react';
import { Helmet } from "react-helmet";
import StarryBackground from "@/components/layout/StarryBackground";
import { MainNav } from "@/components/layout/MainNav";
import { NewFooter } from "@/components/home/NewFooter";
import { motion } from "framer-motion";
import Section from '@/components/Section';
import Button from '@/components/Button';
import ProcessStep from '@/components/ProcessStep';
import TierCard from '@/components/TierCard';
import FeatureCard from '@/components/FeatureCard';
import AnimatedImage from '@/components/AnimatedImage';
import { 
  Star, 
  Gem, 
  ArrowUpRight, 
  Handshake, 
  User, 
  CheckCheck, 
  Lock, 
  Globe, 
  Monitor, 
  Rocket, 
  BadgeCheck, 
  RefreshCcw, 
  Heart,
  Sparkles,
  ArrowRight,
  Flame,
  TrendingUp
} from 'lucide-react';
import { Link } from "react-router-dom";

const Index = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Handle mouse movement for hero section interactivity
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      setMousePosition({ x, y });
    };

    // Intersection Observer for scroll animations
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1,
    };

    const handleIntersect = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show-element', 'slide-normal');
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);
    const elements = document.querySelectorAll('.hidden-element');
    
    elements.forEach((el) => observer.observe(el));
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      observer.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Trending NFTs data
  const trendingNfts = [
    { 
      id: 1, 
      name: "Cyber Punk #238", 
      image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80",
      collection: "Cyber Series",
      price: "2.5 ETH",
      timeLeft: "2d 5h"
    },
    { 
      id: 2, 
      name: "Digital Dream #42", 
      image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?q=80&w=2000&auto=format&fit=crop",
      collection: "Dreams",
      price: "1.8 ETH",
      timeLeft: "1d 12h"
    },
    { 
      id: 3, 
      name: "Neon City #189", 
      image: "https://images.unsplash.com/photo-1482855549413-2a6c9b1955a7?auto=format&fit=crop&w=800&q=80",
      collection: "Neon World",
      price: "0.9 ETH",
      timeLeft: "6h 30m"
    },
    { 
      id: 4, 
      name: "Cosmic Voyage #05", 
      image: "https://images.unsplash.com/photo-1518365050014-70fe7232897f?auto=format&fit=crop&w=800&q=80",
      collection: "Space Explorers",
      price: "3.2 ETH",
      timeLeft: "4d 8h"
    }
  ];

  return (
    <>
      <Helmet>
        <title>NEFTIT - Complete Quests, Earn & Upgrade NFTs</title>
        <meta 
          name="description" 
          content="Join NEFTIT to complete exciting quests, earn unique NFTs, and upgrade them to unlock rarer assets. Start your NFT collection journey today!" 
        />
        <meta name="keywords" content="NFT quests, NFT rewards, NFT upgrades, Web3 engagement, NFT collection" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="NEFTIT - Complete Quests, Earn & Upgrade NFTs" />
        <meta property="og:description" content="Join NEFTIT to complete exciting quests, earn unique NFTs, and upgrade them to unlock rarer assets." />
        <meta property="og:image" content="/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <div className="min-h-screen bg-[#0B0A14] relative overflow-hidden">
        {/* Enhanced Background with Starry Effect */}
        
        
        {/* Background Grid and Gradient Overlay */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#FF3BFF]/5 via-[#36F9F6]/5 to-[#5C24FF]/5 backdrop-blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
        </div>
        
        {/* Animated Gradient Orbs */}
        <motion.div
          className="fixed -top-24 -right-24 w-64 h-64 rounded-full blur-3xl"
          animate={{
            background: [
              "rgba(255,59,255,0.15)",
              "rgba(54,249,246,0.15)",
              "rgba(92,36,255,0.15)",
              "rgba(255,59,255,0.15)",
            ],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="fixed -bottom-24 -left-24 w-64 h-64 rounded-full blur-3xl"
          animate={{
            background: [
              "rgba(54,249,246,0.15)",
              "rgba(92,36,255,0.15)",
              "rgba(255,59,255,0.15)",
              "rgba(54,249,246,0.15)",
            ],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        
        <MainNav />
        <main className="container mx-auto px-4 pt-0 mt-0 pb-12 relative z-10">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="space-y-20 pb-20"
          >
            {/* Hero Section - Modern NFT Marketplace Style */}
            <section className="pt-16 pb-16 relative overflow-hidden">
              <div className="container-custom relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <motion.div 
                    className="order-2 lg:order-1"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                  >
                    <div className="mb-6">
                      <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 backdrop-blur-lg border border-white/10 mb-4">
                        <Sparkles size={14} className="inline-block mr-2 text-[#36F9F6]" />
                        <span className="text-text-secondary text-sm font-medium">NFT Marketplace</span>
                      </div>
                    </div>
                    
                    <h1 className="text-4xl md:text-6xl font-bold mb-6">
                      <span className="gradient-text-enabled">
                        Discover, Collect
                      </span>
                      <br />
                      <span className="text-[#FF3BFF]">& Upgrade NFTs</span>
                    </h1>
                    
                    <p className="text-lg text-text-secondary mb-8">
                      Engage in exciting quests, collect exclusive NFTs, and level them up to unlock even rarer assets.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 mb-8">
                      <Link to="/discover">
                        <Button size="lg" className="bg-gradient-to-r from-[#36F9F6] to-[#FF3BFF] text-text-primary border-none shadow-lg shadow-[#FF3BFF]/20 hover:shadow-[#FF3BFF]/30 hover:scale-105 transition-all duration-300">
                          <Rocket size={18} className="mr-2" />
                          Explore NFTs
                        </Button>
                      </Link>
                      <Link to="#how-it-works">
                        <Button variant="secondary" size="lg" className="backdrop-blur-md bg-white/5 border-white/10 text-text-primary hover:bg-white/10 hover:scale-105 transition-all duration-300">
                          Create Account
                        </Button>
                      </Link>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center py-3 rounded-lg bg-white/5 backdrop-blur-sm">
                        <p className="text-2xl font-bold text-white mb-1">200+</p>
                        <p className="text-sm text-gray-400">Collections</p>
                      </div>
                      <div className="text-center py-3 rounded-lg bg-white/5 backdrop-blur-sm">
                        <p className="text-2xl font-bold text-white mb-1">10K+</p>
                        <p className="text-sm text-gray-400">NFTs</p>
                      </div>
                      <div className="text-center py-3 rounded-lg bg-white/5 backdrop-blur-sm">
                        <p className="text-2xl font-bold text-white mb-1">5K+</p>
                        <p className="text-sm text-gray-400">Users</p>
                      </div>
                    </div>
                  </motion.div>
                  
                  <motion.div 
                    className="order-1 lg:order-2 relative"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                  >
                    <div className="relative rounded-2xl overflow-hidden aspect-square">
                      <img 
                        src="https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80" 
                        alt="Featured NFT" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-sm text-gray-300 mb-1">Cyber Series</p>
                            <h3 className="text-xl font-bold text-white">Cyber Punk #238</h3>
                          </div>
                          <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2">
                            <p className="text-sm text-gray-300">Current Bid</p>
                            <p className="text-lg font-bold text-white">2.5 ETH</p>
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
                        <p className="text-sm font-medium text-white flex items-center">
                          <Flame className="w-4 h-4 mr-1 text-orange-500" />
                          Hot Deal
                        </p>
                      </div>
                    </div>
                    
                    <div className="absolute -bottom-6 -right-6 -z-10 w-full h-full rounded-2xl bg-gradient-to-r from-[#36F9F6]/30 to-[#FF3BFF]/30 blur-xl"></div>
                  </motion.div>
                </div>
              </div>
            </section>
            
            {/* Trending NFTs Section */}
            <section className="py-12">
              <div className="container-custom">
                <div className="flex justify-between items-center mb-8">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <h2 className="text-3xl font-bold">
                      <span className="gradient-text-enabled">Trending NFTs</span>
                    </h2>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Link to="/discover">
                      <Button variant="secondary" className="backdrop-blur-md bg-white/5 border-white/10 text-text-primary hover:bg-white/10 transition-all duration-300">
                        View All
                        <ArrowRight size={16} className="ml-2" />
                      </Button>
                    </Link>
                  </motion.div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {trendingNfts.map((nft, index) => (
                    <motion.div
                      key={nft.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="backdrop-blur-md bg-black/20 border border-white/10 rounded-xl overflow-hidden hover:shadow-lg hover:shadow-[#36F9F6]/10 hover:border-white/20 transition-all duration-300"
                    >
                      <div className="relative">
                        <img 
                          src={nft.image} 
                          alt={nft.name} 
                          className="w-full aspect-square object-cover"
                        />
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1">
                          <p className="text-xs font-medium text-white flex items-center">
                            <TrendingUp className="w-3 h-3 mr-1 text-[#36F9F6]" />
                            {nft.timeLeft}
                          </p>
                        </div>
                      </div>
                      
                      <div className="p-4">
                        <p className="text-sm text-gray-400 mb-1">{nft.collection}</p>
                        <h3 className="text-lg font-semibold text-white mb-2">{nft.name}</h3>
                        
                        <div className="flex justify-between items-center pt-2 border-t border-white/10">
                          <div>
                            <p className="text-xs text-gray-400">Price</p>
                            <p className="text-base font-medium text-white">{nft.price}</p>
                          </div>
                          <Link to="/discover">
                            <Button variant="secondary" size="sm" className="text-xs px-3 py-1 bg-white/5 hover:bg-white/10 border-white/10">
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
            
            {/* How It Works Section */}
            <Section id="how-it-works" className="py-12" animate="none">
              <div className="container-custom">
                <motion.div 
                  className="text-center max-w-3xl mx-auto mb-16"
                  initial={{ opacity: 0, y: -20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  viewport={{ once: true }}
                >
                  <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 backdrop-blur-lg border border-white/10 mb-4">
                    <User size={14} className="inline-block mr-2 text-[#36F9F6]" />
                    <span className="text-white/80 text-sm font-medium">How It Works</span>
                  </div>
                  <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-[#36F9F6] to-[#FF3BFF] bg-clip-text text-transparent">
                    Your journey to rare NFTs in four simple steps
                  </h2>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {[
                    { 
                      number: "1", 
                      title: "Complete Quests & Challenges", 
                      description: "Participate in social & interactive quests. Follow, retweet, join Discord, solve puzzles, and more!",
                      features: [
                        "Engage with the community",
                        "Complete interactive tasks",
                        "Solve exciting puzzles"
                      ],
                      delay: 0.2
                    },
                    { 
                      number: "2", 
                      title: "Earn & Collect NFTs", 
                      description: "Every completed quest rewards you with a unique NFT. Our NFTs are visually stunning, highly collectible, and valuable.",
                      features: [
                        "Earn unique NFTs",
                        "Build your collection",
                        "Get guaranteed rewards"
                      ],
                      delay: 0.3
                    },
                    { 
                      number: "3", 
                      title: "Upgrade Your NFTs", 
                      description: "Start with Common NFTs and burn them to upgrade to higher tiers. Follow the upgrade path to reach the exclusive Gold tier!",
                      features: [
                        "5 Commons → 1 Platinum",
                        "5 Platinum → 1 Silver",
                        "5 Silver → 1 Gold"
                      ],
                      delay: 0.4
                    },
                    { 
                      number: "4", 
                      title: "Showcase, Trade & Hold", 
                      description: "Trade your NFTs on leading marketplaces, showcase your collection, and hold for exclusive future perks.",
                      features: [
                        "Trade on marketplaces",
                        "Show off your collection",
                        "Access exclusive benefits"
                      ],
                      delay: 0.5
                    }
                  ].map((step, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.7, delay: step.delay }}
                      viewport={{ once: true }}
                      className="backdrop-blur-xl bg-black/20 border border-white/10 rounded-xl p-6 hover:bg-black/30 hover:border-white/20 transition-all duration-300"
                    >
                      <ProcessStep 
                        number={step.number} 
                        title={step.title} 
                        description={step.description}
                        features={step.features}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            </Section>
            
            {/* NFT System Section */}
            <Section id="nft-system" animate="fade">
              <div className="container-custom">
                <div className="text-center max-w-3xl mx-auto mb-16">
                  <h2 className="title text-gradient mb-4">The NEFTIT NFT System</h2>
                  <p className="body-large text-muted-foreground">
                    Upgrade your NFTs for maximum rarity & exclusivity
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="hidden-element slide-from-bottom delay-1">
                    <TierCard 
                      title="Common" 
                      description="Start your journey with Common NFTs" 
                      details="Complete quests to earn Common NFTs"
                      colorClass="bg-neftit-common"
                    />
                  </div>
                  
                  <div className="hidden-element slide-from-bottom delay-2">
                    <TierCard 
                      title="Platinum & Silver" 
                      description="Burn & upgrade to higher tiers" 
                      details="5 Commons → 1 Platinum, 5 Platinum → 1 Silver"
                      colorClass="bg-gradient-to-r from-neftit-platinum to-neftit-silver"
                    />
                  </div>
                  
                  <div className="hidden-element slide-from-bottom delay-3">
                    <TierCard 
                      title="Gold" 
                      description="Reach the exclusive Gold tier" 
                      details="5 Silver → 1 Gold (Super rare & exclusive)"
                      colorClass="bg-neftit-gold"
                    />
                  </div>
                </div>
              </div>
            </Section>
            
            {/* Benefits Section */}
            <Section id="benefits" animate="fade">
              <div className="container-custom">
                <div className="text-center max-w-3xl mx-auto mb-16">
                  <h2 className="title text-gradient mb-4">Why Users Love NEFTIT</h2>
                  <p className="body-large text-muted-foreground">
                    Join thousands of users already collecting and upgrading NFTs
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  <div className="hidden-element slide-from-bottom delay-1">
                    <FeatureCard 
                      icon={Star} 
                      title="Free to Join" 
                      description="No hidden fees, just complete quests and earn rewards"
                    />
                  </div>
                  
                  <div className="hidden-element slide-from-bottom delay-2">
                    <FeatureCard 
                      icon={Heart} 
                      title="Fun & Interactive" 
                      description="Engage with Web3 in a fresh, exciting way"
                    />
                  </div>
                  
                  <div className="hidden-element slide-from-bottom delay-3">
                    <FeatureCard 
                      icon={RefreshCcw} 
                      title="Upgrade System" 
                      description="Keep progressing and leveling up your collection"
                    />
                  </div>
                  
                  <div className="hidden-element slide-from-bottom delay-4">
                    <FeatureCard 
                      icon={Lock} 
                      title="Anti-Bot Protection" 
                      description="We ensure a fair system for all users"
                    />
                  </div>
                  
                  <div className="hidden-element slide-from-bottom delay-5">
                    <FeatureCard 
                      icon={Globe} 
                      title="Global Access" 
                      description="Anyone can participate, anytime, anywhere"
                    />
                  </div>
                  
                  <div className="hidden-element slide-from-bottom delay-6">
                    <FeatureCard 
                      icon={BadgeCheck} 
                      title="Verified Projects" 
                      description="Only authentic Web3 projects in our ecosystem"
                    />
                  </div>
                </div>
              </div>
            </Section>
            
            {/* CTA Section */}
            <Section id="join-now" className="bg-gradient-to-b from-background to-indigo-900/10 py-16" animate="fade">
              <div className="container-custom">
                <div className="text-center max-w-3xl mx-auto">
                  <div className="hidden-element glass-card p-10 rounded-3xl border border-white/10 shadow-lg backdrop-blur-lg">
                    <h2 className="title text-gradient mb-6 text-4xl md:text-5xl font-bold">Start Your NFT Journey Today</h2>
                    <p className="body-large text-muted-foreground mb-10 text-xl">
                      Engage. Collect. Upgrade. Be Part of the Future of NFTs!
                    </p>
                    <Link to="/auth">
                      <Button size="lg" className="px-8 py-4 bg-gradient-to-r from-neftit-blue to-neftit-purple border-none text-lg font-medium shadow-[0_0_20px_rgba(68,98,237,0.3)] hover:shadow-[0_0_30px_rgba(68,98,237,0.5)] transition-all duration-300">
                        <Rocket size={20} className="mr-2" />
                        Join Now
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Section>
          </motion.div>
        </main>

        <NewFooter />
      </div>
    </>
  );
};

export default Index;
