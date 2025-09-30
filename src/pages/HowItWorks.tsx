import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import {
  Brain,
  Rocket,
  Users,
  CheckCircle2,
  Star,
  Flame,
  ArrowRight,
  BadgeCheck,
  ShieldCheck,
  AlertTriangle,
  Gem,
  KeyRound,
  TrendingUp,
  Zap,
  Wallet,
  Crown,
  XCircle,
  Activity,
  Award,
  Coins,
  UserCheck,
  Info,
  ShieldAlert,
  EyeOff,
  UserX,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "react-router-dom";

const timelineSteps = [
  {
    icon: <Users className="w-6 h-6 sm:w-8 sm:h-8 text-[#5d43ef]" />, title: "Join NEFTIT", desc: "Sign up and connect your wallet + socials"
  },
  {
    icon: <Rocket className="w-6 h-6 sm:w-8 sm:h-8 text-[#5d43ef]" />, title: "Choose Campaigns", desc: "Select from partnered Web3 projects"
  },
  {
    icon: <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-[#5d43ef]" />, title: "Complete Tasks", desc: "Engage in missions (follow, like, RT, etc.)"
  },
  {
    icon: <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-[#5d43ef]" />, title: "Earn Offchain NFTs", desc: "Get reward NFTs instantly in your wallet"
  },
  {
    icon: <Flame className="w-6 h-6 sm:w-8 sm:h-8 text-[#5d43ef]" />, title: "Burn & Upgrade", desc: "Combine lower-tier NFTs to unlock rare ones"
  },
  {
    icon: <Gem className="w-6 h-6 sm:w-8 sm:h-8 text-[#5d43ef]" />, title: "Claim Onchain NFTs", desc: "After burning or holding, claim to blockchain"
  },
  {
    icon: <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-[#5d43ef]" />, title: "Earn NEFT Points", desc: "Boost your status, unlock loyalty perks"
  },
  {
    icon: <KeyRound className="w-6 h-6 sm:w-8 sm:h-8 text-[#5d43ef]" />, title: "Redeem & Access", desc: "Use NFTs and points for gated access, airdrops, and store rewards"
  },
];

const whyHold = [
  { icon: <Award className="w-5 h-5 sm:w-7 sm:h-7 text-[#5d43ef]" />, title: "Increased Rewards", desc: "Earn bonus multipliers on future campaigns" },
  { icon: <Crown className="w-5 h-5 sm:w-7 sm:h-7 text-[#5d43ef]" />, title: "Exclusive Access", desc: "Unlock premium quests and gated utilities" },
  { icon: <UserCheck className="w-5 h-5 sm:w-7 sm:h-7 text-[#5d43ef]" />, title: "Community Status", desc: "Get holder badges, roles, and Discord perks" },
  { icon: <Zap className="w-5 h-5 sm:w-7 sm:h-7 text-[#5d43ef]" />, title: "Future Airdrops", desc: "Eligible for token/NFT drops and mystery boxes" },
];
const whyNot = [
  { icon: <XCircle className="w-4 h-4 sm:w-6 sm:h-6 text-[#ef4343]" />, text: "Lost Upgrades" },
  { icon: <XCircle className="w-4 h-4 sm:w-6 sm:h-6 text-[#ef4343]" />, text: "No reward multipliers" },
  { icon: <XCircle className="w-4 h-4 sm:w-6 sm:h-6 text-[#ef4343]" />, text: "Missed airdrops" },
  { icon: <XCircle className="w-4 h-4 sm:w-6 sm:h-6 text-[#ef4343]" />, text: "Blocked from holder-only campaigns" },
];

const burnCombos = [
  { 
    combo: "5 Common → 1 Platinum",
    elements: [
      { text: "5 ", color: "text-white" },
      { text: "Common", color: "text-[#94A3B8]" },
      { text: " → 1 ", color: "text-white" },
      { text: "Platinum", color: "text-indigo-300" }
    ]
  },
  { 
    combo: "3 Rare → 1 Platinum",
    elements: [
      { text: "3 ", color: "text-white" },
      { text: "Rare", color: "text-[#94A3B8]" },
      { text: " → 1 ", color: "text-white" },
      { text: "Platinum", color: "text-indigo-300" }
    ]
  },
  { 
    combo: "2 Legendary → 1 Platinum",
    elements: [
      { text: "2 ", color: "text-white" },
      { text: "Legendary", color: "text-[#94A3B8]" },
      { text: " → 1 ", color: "text-white" },
      { text: "Platinum", color: "text-indigo-300" }
    ]
  },
  { 
    combo: "5 Platinum → 1 Silver",
    elements: [
      { text: "5 ", color: "text-white" },
      { text: "Platinum", color: "text-indigo-300" },
      { text: " → 1 ", color: "text-white" },
      { text: "Silver", color: "text-white/80" }
    ]
  },
  { 
    combo: "5 Silver → 1 Gold",
    elements: [
      { text: "5 ", color: "text-white" },
      { text: "Silver", color: "text-slate-300" },
      { text: " → 1 ", color: "text-white" },
      { text: "Gold", color: "text-yellow-300" }
    ]
  },
];

const usps = [
  "Multichain reward system",
  "Gasless offchain NFT logic",
  "Burn-to-upgrade reward economy",
  "Project discovery + loyalty gamification",
  "Strong anti-bot system from day one",
  "Identity-first — not just quests, but user rep",
];

export default function HowItWorks() {
  const isMobile = useIsMobile();

  return (
    <Layout>
      <div className="relative min-h-screen bg-[#0b0a14] font-sora overflow-x-hidden">
        {/* Animated background grid and floating gradients */}
        
        <main className="relative z-10 px-2 sm:px-4 pt-0 mt-0 pb-16">
          {/* Hero Section */}
          <motion.section initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="mb-20 sm:mb-32 md:mb-56 text-center relative">
            <div className="inline-flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 md:mb-6">
              <div className="flex items-end py-2 sm:py-3 justify-center">
              <span className="rounded-full bg-[#1b1930] p-2 sm:p-3 border border-[#382e78] animate-float"><Brain className="w-5 h-5 sm:w-6 sm:h-6 md:w-9 md:h-9 text-[#5d43ef]" /></span>
              </div>
              <span className="text-lg sm:text-lg md:text-2xl lg:text-3xl font-bold text-[#5d43ef] tracking-wide uppercase">How NEFTIT Works</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4 md:mb-6 leading-tight drop-shadow-lg px-2">Gamified Web3 Growth. Earn. Upgrade. Win</h1>
            <p className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl text-[#94A3B8] max-w-2xl mx-auto mb-6 sm:mb-8 md:mb-14 px-2">Complete social tasks, earn evolving NFTs, and unlock deeper access across campaigns, utilities, and drops. Level up your Web3 journey.</p>
            <div className="flex justify-center gap-3 sm:gap-4 mt-3 sm:mt-4 md:mt-6">
              <Link to="/discover">
                <Button className="bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] hover:from-[#5d43ef]/80 hover:via-[#5d43ef]/60 hover:to-[rgb(155,160,235)] text-white font-bold px-4 sm:px-6 md:px-8 py-2 sm:py-3 rounded-lg text-xs sm:text-sm md:text-lg shadow-lg">
                  Get Started
                  <ArrowRight className="ml-2 w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                </Button>
              </Link>
            </div>
          </motion.section>

          {/* Timeline Section */}
          <motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }} className="mb-12 sm:mb-16 md:mb-24">
            <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white mb-4 sm:mb-6 md:mb-10 flex items-center justify-center px-2"> Step-by-Step Flow</h2>
            <div className="relative flex flex-col lg:flex-row lg:items-start gap-2 sm:gap-4 lg:gap-4 justify-center">
              {/* Timeline vertical for mobile and tablet, horizontal for desktop */}
              <ol className="relative flex flex-col lg:flex-row lg:items-start gap-2 sm:gap-4 lg:gap-4 justify-between w-full">
                {timelineSteps.map((step, i) => (
                  <motion.li
                    key={step.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                    className="relative z-10 mb-2 sm:mb-4 lg:mb-0 lg:mr-0 lg:flex-1 lg:min-w-[140px] group"
                  >
                    {/* Connector line */}
                    {i !== 0 && (
                      <span className="absolute left-1/2 top-0 lg:left-0 lg:top-1/2 lg:-translate-y-1/2 lg:-translate-x-0 -translate-x-1/2 w-1 h-6 sm:h-8 lg:h-12 lg:w-12 bg-gradient-to-b lg:bg-gradient-to-r from-[#38B2AC]/40 to-purple-400/40 blur-sm animate-pulse-glow" />
                    )}
                    <div className="glass-card rounded-lg sm:rounded-xl md:rounded-2xl p-2 sm:p-3 md:p-4 lg:p-6 flex flex-col items-center text-center shadow-xl border border-[#38B2AC]/20 hover:scale-105 transition-transform duration-300 backdrop-blur-xl h-[70px] sm:h-[90px] md:h-[140px] lg:h-[320px] flex-shrink-0">
                      <div className="mb-1 sm:mb-2 md:mb-4 animate-float group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                        {step.icon}
                      </div>
                      <div className="font-bold text-white text-[10px] sm:text-xs md:text-base lg:text-lg mb-1 drop-shadow-lg flex-shrink-0">{step.title}</div>
                      <div className="text-[#94A3B8] text-[8px] sm:text-[10px] md:text-sm lg:text-base flex-1 flex items-center justify-center text-center leading-relaxed">{step.desc}</div>
                    </div>
                  </motion.li>
                ))}
              </ol>
            </div>
          </motion.section>

          {/* Why Hold Section */}
          <motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.2 }} className="mb-12 sm:mb-16 md:mb-24 flex flex-col items-center justify-center">
            <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white mb-4 sm:mb-6 md:mb-8 flex items-center justify-center gap-2 px-2"><Star className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-[#5d43ef]" /> Why Hold NEFTIT NFTs?</h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-accent mb-6 sm:mb-8 font-semibold text-center px-2">
              Holding is winning. Selling early = missing out.
            </p>
            <div className="flex flex-row gap-2 sm:gap-3 md:gap-4 lg:gap-8 w-full max-w-4xl">
                  {/* Benefits of Holding */}
                    <div className="glass-card border flex-1 h-auto">
                    <div className="p-2 sm:p-3 md:p-4 lg:p-6 xl:p-8 h-full w-full flex flex-col">
                      <div className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-[#5d43ef] flex items-center font-bold mb-2 sm:mb-3 md:mb-4 lg:mb-6">
                        <TrendingUp className="mr-1.5 sm:mr-2 md:mr-3 h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 xl:h-8 xl:w-8 text-[#5d43ef]" />
                        <span className="text-white text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">Benefits of Holding</span>
                      </div>
                      <div className="space-y-2 sm:space-y-3 md:space-y-4 flex-1">
                        <div className="flex items-start space-x-2 sm:space-x-3 md:space-x-4">
                          <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 text-[#5d43ef] mt-0.5 sm:mt-1 flex-shrink-0" />
                          <div>
                            <h4 className="font-semibold mb-1 text-xs sm:text-sm md:text-base lg:text-lg">Increased Rewards</h4>
                            <p className="text-[10px] sm:text-xs md:text-sm lg:text-base text-[#94A3B8]">Earn bonus multipliers on future campaigns</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2 sm:space-x-3 md:space-x-4">
                          <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 text-[#5d43ef] mt-0.5 sm:mt-1 flex-shrink-0" />
                          <div>
                            <h4 className="font-semibold mb-1 text-xs sm:text-sm md:text-base lg:text-lg">Exclusive Access</h4>
                            <p className="text-[10px] sm:text-xs md:text-sm lg:text-base text-[#94A3B8]">Unlock premium quests and gated utilities</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2 sm:space-x-3 md:space-x-4">
                          <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 text-[#5d43ef] mt-0.5 sm:mt-1 flex-shrink-0" />
                          <div>
                            <h4 className="font-semibold mb-1 text-xs sm:text-sm md:text-base lg:text-lg">Community Status</h4>
                            <p className="text-[10px] sm:text-xs md:text-sm lg:text-base text-[#94A3B8]">Get holder badges, roles, and Discord perks</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2 sm:space-x-3 md:space-x-4">
                          <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 text-[#5d43ef] mt-0.5 sm:mt-1 flex-shrink-0" />
                          <div>
                            <h4 className="font-semibold mb-1 text-xs sm:text-sm md:text-base lg:text-lg">Future Airdrops</h4>
                            <p className="text-[10px] sm:text-xs md:text-sm lg:text-base text-[#94A3B8]">Eligible for token/NFT drops and mystery boxes</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Consequences of Selling Early */}
                    <div className="glass-card border flex-1 h-auto">
                    <div className="p-2 sm:p-3 md:p-4 lg:p-6 xl:p-8 h-full w-full flex flex-col">
                      <div className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-neftit-red flex items-center font-bold mb-2 sm:mb-3 md:mb-4 lg:mb-6">
                        <AlertTriangle className="mr-1.5 sm:mr-2 md:mr-3 h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 xl:h-8 xl:w-8 text-[#f97316]" />
                        <span className="text-white text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">Selling Early Means</span>
                      </div>
                      <div className="space-y-2 sm:space-y-3 md:space-y-4 flex-1">
                        <div className="flex items-start space-x-2 sm:space-x-3 md:space-x-4">
                          <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 text-[#f97316] mt-0.5 sm:mt-1 flex-shrink-0" />
                          <div>
                            <h4 className="font-semibold mb-1 text-xs sm:text-sm md:text-base lg:text-lg">Lost Upgrades</h4>
                            <p className="text-[10px] sm:text-xs md:text-sm lg:text-base text-[#94A3B8]">No reward multipliers</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2 sm:space-x-3 md:space-x-4">
                          <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 text-neftit-red mt-0.5 sm:mt-1 flex-shrink-0 text-[#f97316]" />
                          <div>
                            <h4 className="font-semibold mb-1 text-xs sm:text-sm md:text-base lg:text-lg">Missed Airdrops</h4>
                            <p className="text-[10px] sm:text-xs md:text-sm lg:text-base text-[#94A3B8]">No future token/NFT drops</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2 sm:space-x-3 md:space-x-4">
                          <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 text-neftit-red mt-0.5 sm:mt-1 flex-shrink-0 text-[#f97316]" />
                          <div>
                            <h4 className="font-semibold mb-1 text-xs sm:text-sm md:text-base lg:text-lg">Blocked Access</h4>
                            <p className="text-[10px] sm:text-xs md:text-sm lg:text-base text-[#94A3B8]">Locked out from holder-only campaigns</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
          </motion.section>

          {/* Burn Mechanism Section */}
          <motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.3 }} className="mb-12 sm:mb-16 md:mb-24 flex flex-col items-center justify-center">
            <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white mb-4 sm:mb-6 md:mb-8 flex items-center justify-center gap-2 px-2"><Flame className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-[#5d43ef]" /> Burn Mechanism</h2>
            <div className="glass-card rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 lg:p-8 border border-[#38B2AC]/20 shadow-xl flex flex-col md:flex-row gap-4 sm:gap-6 md:gap-8 items-center justify-between w-full max-w-4xl">
              <div className="flex-1">
                <ul className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
                  {burnCombos.map((combo, i) => (
                    <li key={i} className="text-xs sm:text-sm md:text-lg text-white flex items-center gap-2 sm:gap-3">
                      <Flame className="w-3 h-3 sm:w-4 sm:h-4 md:w-6 md:h-6 text-[#5d43ef]" />
                      {combo.elements.map((element, j) => (
                        <span key={j} className={element.color}>
                          {element.text}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
                <div className="text-[#94A3B8] text-xs sm:text-sm md:text-lg mb-2">Burning gives you access to higher-tier NFTs + better campaign rewards</div>
                <div className="text-[#94A3B8] text-xs sm:text-sm md:text-lg">Burn can be <span className="text-white font-semibold">offchain</span> (auto backend) or <span className="text-white">onchain</span> (user claim + burn + upgrade flow)</div>
              </div>
            </div>
          </motion.section>

          {/* NEFT Points Section */}
          <motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.4 }} className="mb-12 sm:mb-16 md:mb-24 flex flex-col items-center justify-center">
            <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white mb-4 sm:mb-6 md:mb-8 flex items-center justify-center gap-2 px-2"><Coins className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-[#5d43ef]" /> What is NEFT?</h2>
            <div className="glass-card rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 lg:p-8 border border-[#38B2AC]/20 shadow-xl w-full max-w-4xl">
              <ul className="list-disc pl-3 sm:pl-4 md:pl-6 text-[#94A3B8] space-y-2 sm:space-y-3 text-xs sm:text-sm md:text-lg">
                <li><span className="text-white font-semibold">NEFT</span> is the point system of NEFTIT</li>
                <li>Users earn NEFT Points via campaign activity, holding, and upgrades</li>
                <li>Points unlock reward tiers, loyalty store items, and special partner campaigns</li>
                <li><span className="text-white font-semibold">NEFT</span> will become a key metric in future token eligibility or reputation scoring</li>
              </ul>
            </div>
          </motion.section>

          {/* Security Section */}
          <motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.5 }} className="mb-12 sm:mb-16 md:mb-24">
            <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-white mb-4 sm:mb-6 md:mb-8 text-center px-2">Anti-Bot & Security System</h2>
            <div className="glass-card rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 lg:p-8 border border-[#38B2AC]/20 shadow-xl max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 md:gap-12 items-start">
              {/* Features Section */}
              <div>
                <ul className="space-y-3 sm:space-y-4 md:space-y-5 text-xs sm:text-sm md:text-base leading-relaxed">
                  <li className="flex items-start gap-2 sm:gap-3">
                    <ShieldAlert className="text-[#5d43ef] w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 mt-1" />
                    <span><strong>Instant Bot Detection & Ban</strong><span className="text-[#94A3B8]"> — Suspicious scripts, fake clicks, and automation tools are auto-blocked in real time.</span></span>
                  </li>
                  <li className="flex items-start gap-2 sm:gap-3">
                    <EyeOff className="text-[#5d43ef] w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 mt-1" />
                    <span><strong>One Account Policy</strong><span className="text-[#94A3B8]"> — Strict enforcement of one wallet per device/IP — no room for multi-account abuse.</span></span>
                  </li>
                  <li className="flex items-start gap-2 sm:gap-3">
                    <UserX className="text-[#5d43ef] w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 mt-1" />
                    <span><strong>Smart Behavior Analysis</strong><span className="text-[#94A3B8]"> — We track session depth, user flow, and activity patterns to ensure real human interaction.</span></span>
                  </li>
                  <li className="flex items-start gap-2 sm:gap-3">
                    <Clock3 className="text-[#5d43ef] w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 mt-1" />
                    <span><strong>Effort-Based Reward System</strong><span className="text-[#94A3B8]"> — Rewards are fairly distributed based on authentic user engagement, not volume spam.</span></span>
                  </li>
                  <li className="flex items-start gap-2 sm:gap-3">
                    <ShieldAlert className="text-[#5d43ef] w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 mt-1" />
                    <span><strong>AI-Powered Real-Time Monitoring</strong><span className="text-[#94A3B8]"> — A combination of admin and AI systems actively monitors & shuts down manipulation attempts.</span></span>
                  </li>
                </ul>
              </div>
              {/* Warning Section */}
              <div className="bg-[#1a1a2f] border-l-4 border-red-500 p-3 sm:p-4 md:p-6 rounded-lg sm:rounded-xl shadow-xl">
                <div className="flex items-start gap-2 sm:gap-3">
                  <AlertTriangle className="text-red-500 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 mt-1" />
                  <div>
                    <h3 className="text-sm sm:text-lg md:text-xl font-semibold text-red-400 mb-2">Abuse Warning</h3>
                    <p className="text-[10px] sm:text-xs md:text-sm leading-relaxed text-gray-300 mb-2">
                      🚨 Any attempt to bypass the system through:
                    </p>
                    <ul className="list-disc pl-3 sm:pl-4 md:pl-5 text-[10px] sm:text-xs md:text-sm text-gray-300 mb-2 space-y-1">
                      <li>Multiple wallets or accounts</li>
                      <li>Shared IP devices</li>
                      <li>Automated actions or fake traffic</li>
                    </ul>
                    <p className="text-[10px] sm:text-xs md:text-sm text-gray-300">
                      …will result in an <span className="text-white font-bold">immediate ban and blacklist</span> from all <span className="text-white font-bold">current and future campaigns</span>.
                    </p>
                    <p className="text-[10px] sm:text-xs md:text-sm mt-3 text-gray-400">We are committed to protecting fairness for our real users.</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* USPs Section */}
          <motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.6 }} className="mb-16 sm:mb-24 md:mb-32 text-center">
            <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white mb-4 sm:mb-6 md:mb-8 flex items-center gap-2 justify-center px-2"><Gem className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-[#5d43ef]" /> Why NEFTIT is Different</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6 max-w-2xl mx-auto mb-6 sm:mb-8 md:mb-10">
              {usps.map((usp, i) => (
                <li key={i} className="glass-card rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 text-white text-xs sm:text-sm md:text-lg flex items-center gap-2 sm:gap-3 md:gap-4 border shadow">
                  <Star className="w-3 h-3 sm:w-4 sm:h-4 md:w-6 md:h-6 text-[#5d43ef]" /> {usp}
                </li>
              ))}
            </ul>
            {/* <div className="mt-4 sm:mt-6 md:mt-8">
              <Button className="bg-gradient-to-r from-[#5d43ef]/80 to-[#7d83d8] text-white font-bold px-4 sm:px-6 md:px-10 py-2 sm:py-3 md:py-4 rounded-lg sm:rounded-xl md:rounded-2xl text-xs sm:text-base md:text-xl shadow-xl" size="lg">
                Get Started with NEFTIT
                <ArrowRight className="ml-2 sm:ml-3 w-3 h-3 sm:w-4 sm:h-4 md:w-6 md:h-6" />
              </Button>
            </div> */}
          </motion.section>

          {/* FAQ Section */}
          <motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.7 }} className="mb-8 sm:mb-12 md:mb-16 max-w-2xl mx-auto">
            <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white mb-4 sm:mb-6 md:mb-8 flex items-center gap-2 justify-center px-2"><Info className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-[#5d43ef]" /> FAQ</h2>
            <div className="space-y-2 sm:space-y-3 md:space-y-4">
              {[
                {
                  q: "What is NEFTIT?",
                  a: "NEFTIT is a gamified Web3 growth platform where users complete tasks for partner projects and earn NFTs as rewards. These NFTs can be upgraded, burned, held for access, or used for loyalty benefits."
                },
                {
                  q: "How do I start using NEFTIT?",
                  a: "Simply connect your wallet and socials, pick a campaign, and start completing missions. You'll earn NFTs offchain first, then choose whether to burn, upgrade, or claim onchain."
                },
                {
                  q: "Are NEFTIT NFTs free to earn?",
                  a: "Yes. Completing tasks earns you NFTs without any payment. Claiming them onchain may require gas fees, but most of NEFTIT's logic runs offchain to save costs."
                },
                {
                  q: "Why should I hold my NFTs instead of selling them?",
                  a: "Holding unlocks future airdrops, access to exclusive campaigns, community roles, and reward multipliers. Selling early means missing out on these benefits."
                },
                {
                  q: "How does the burn system work?",
                  a: "You can burn multiple lower-tier NFTs (Common, Rare, Legendary) to upgrade into higher tiers (Platinum, Silver, Gold). Each tier unlocks better perks and visibility."
                },
                {
                  q: "What are NEFT Points?",
                  a: "NEFT Points are our internal reputation and reward system. You earn them by completing tasks, holding NFTs, and participating in campaigns. They'll be used in the future for the NEFT Store and other benefits."
                },
                {
                  q: "Can I use multiple wallets or accounts?",
                  a: "No. NEFTIT has an advanced anti-bot and anti-multi-account system. Users who abuse the system will be automatically banned and blacklisted."
                },
                {
                  q: "Which blockchains does NEFTIT support?",
                  a: "NEFTIT supports multiple chains including Polygon, Solana, Sui, Base, and more with rewards deployable across chains based on partner preference."
                },
              ].map((item, i) => (
                <motion.div
                  key={item.q}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className="glass-card rounded-lg sm:rounded-xl border border-[#38B2AC]/20 shadow p-3 sm:p-4 md:p-6"
                >
                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                    <Info className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#5d43ef] flex-shrink-0" />
                    <span className="font-semibold text-white text-xs sm:text-sm md:text-lg">{item.q}</span>
                  </div>
                  <div className="text-[#94A3B8] text-[10px] sm:text-xs md:text-base pl-5 sm:pl-6 md:pl-8">{item.a}</div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        </main>
          </div>
    </Layout>
  );
}