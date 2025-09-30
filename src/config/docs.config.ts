// src/config/docs.config.ts

export interface SidebarItem {
    title: string;
    slug: string;
  }
  
  export interface SidebarSection {
    title: string;
    items: SidebarItem[];
  }
  
  export const docsSidebar: SidebarSection[] = [
    {
      title: "Introduction",
      items: [
        { title: "Problems Targeted", slug: "introduction/problems-targeted" },
        { title: "Solutions", slug: "introduction/solutions" },
        { title: "Summary", slug: "introduction/summary" },
      ],
    },
    {
      title: "Market Analysis",
      items: [
        { title: "Market Overview", slug: "market-analysis/market-overview" },
        { title: "Conclusion", slug: "market-analysis/conclusion" },
      ],
    },
    {
      title: "Product Summary",
      items: [
        { title: "Key Components of NEFTIT", slug: "product-summary/key-components" },
        { title: "How NEFTIT Works in 3 Simple Steps", slug: "product-summary/how-neftit-works" },
        { title: "A Gamified Web3 Growth Ecosystem", slug: "product-summary/gamified-ecosystem" },
      ],
    },
    {
      title: "NEFTIT NFTs",
      items: [
        { title: "NFT Reward Structure", slug: "neftit-nfts/reward-structure" },
        { title: "NFT Rarity System", slug: "neftit-nfts/rarity-system" },
        { title: "Burn-to-Upgrade Mechanism", slug: "neftit-nfts/burn-to-upgrade" },
        { title: "Off-Chain Burn System (Planning)", slug: "neftit-nfts/offchain-burn" },
        { title: "Multichain Deployment", slug: "neftit-nfts/multichain-deployment" },
        { title: "NFT Utilities", slug: "neftit-nfts/utilities" },
        { title: "Identity & Loyalty", slug: "neftit-nfts/identity-loyalty" },
      ],
    },
    {
      title: "Community Mechanics",
      items: [
        { title: "Engagement Model: Building a Movement", slug: "community-mechanics/engagement-model" },
        { title: "Twitter / Discord Integration", slug: "community-mechanics/twitter-discord-integration" },
        { title: "Task-to-NFT Pipeline (How It Works)", slug: "community-mechanics/task-to-nft-pipeline" },
        { title: "More Key Mechanics", slug: "community-mechanics/more-key-mechanics" },
        { title: "In Summary", slug: "community-mechanics/summary" },
      ],
    },
    {
      title: "Staking & NEFT Points",
      items: [
        { title: "How Staking Works", slug: "staking-neft-points/how-staking-works" },
        { title: "NEFT Points: The Web3 Growth Engine", slug: "staking-neft-points/neft-points" },
        { title: "Earning Boosters", slug: "staking-neft-points/earning-boosters" },
        { title: "Anti-Abuse Mechanisms", slug: "staking-neft-points/anti-abuse" },
        { title: "Sample Point Table", slug: "staking-neft-points/sample-point-table" },
        { title: "In Summary", slug: "staking-neft-points/summary" },
      ],
    },
    {
      title: "Security & Anti-Bot Measures",
      items: [
        { title: "What is a Sybil Attack?", slug: "security-anti-bot/sybil-attack" },
        { title: "How NEFTIT Avoids Sybil Attacks", slug: "security-anti-bot/avoiding-sybil" },
        { title: "Bot Filtering in Campaigns", slug: "security-anti-bot/bot-filtering" },
        { title: "Real-User Priority Mechanism", slug: "security-anti-bot/real-user-priority" },
        { title: "Additional Measures Coming Soon", slug: "security-anti-bot/additional-measures" },
        { title: "What Happens If You’re Flagged?", slug: "security-anti-bot/flagged-users" },
        { title: "Final Note", slug: "security-anti-bot/final-note" },
      ],
    },
    {
      title: "Platform Mechanics",
      items: [
        { title: "Campaign Mechanics for Projects", slug: "platform-mechanics/campaign-mechanics" },
        { title: "User Journey on NEFTIT", slug: "platform-mechanics/user-journey" },
      ],
    },
    {
      title: "Business & Adoption",
      items: [
        { title: "Target Audience / User Personas", slug: "business-adoption/target-audience" },
        { title: "Go-To-Market Strategy", slug: "business-adoption/go-to-market" },
        { title: "Partnership Model", slug: "business-adoption/partnership-model" },
      ],
    },
    {
      title: "Appendix / Extras",
      items: [
        { title: "Glossary", slug: "appendix/glossary" },
        { title: "FAQs", slug: "appendix/faqs" },
        { title: "Contact & Links", slug: "appendix/contact-links" },
        { title: "Team", slug: "appendix/team" },
        { title: "Roadmap", slug: "appendix/roadmap" },
        { title: "Media Kit", slug: "appendix/media-kit" },
      ],
    },
    {
      title: "Legal, Compliance & Risk",
      items: [
        { title: "Legal Information", slug: "legal-compliance-risk/legal-info" },
        { title: "Risks & Challenges", slug: "legal-compliance-risk/risks-challenges" },
        { title: "Terms of Service", slug: "legal-compliance-risk/terms-of-service" },
        { title: "Privacy Policy", slug: "legal-compliance-risk/privacy-policy" },
      ],
    },
  ];
  
  export default docsSidebar;
  