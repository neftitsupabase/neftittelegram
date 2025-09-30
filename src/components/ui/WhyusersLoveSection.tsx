import { useState, useEffect } from "react";
import { RocketAnimation, VerifiedAnimation, GlobalAnimation, ShieldAnimation, TrophyAnimation, HappyAnimation } from "../icons/AnimatedIcons";

const leftFeatures = [
  {
    title: "Free to Join",
    description: "No hidden fees, just complete quests and earn rewards",
    icon: RocketAnimation,
  },
  {
    title: "Fun & Interactive",
    description: "Engage with Web3 in a fresh, exciting way",
    icon: HappyAnimation,
  },
  {
    title: "Upgrade System",
    description: "Keep progressing and leveling up your collection",
    icon: TrophyAnimation,
  },
];

const rightFeatures = [
  {
    title: "Anti-Bot Protection",
    description: "We ensure a fair system for all users",
    icon: ShieldAnimation,
  },
  {
    title: "Global Access",
    description: "Anyone can participate, anytime, anywhere",
    icon: GlobalAnimation,
  },
  {
    title: "Verified Projects",
    description: "Only authentic Web3 projects in our ecosystem",
    icon: VerifiedAnimation,
  },
];

const WhyUsersLoveSection = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect(); // Only trigger once
          }
        });
      },
      { threshold: 0.3 }
    );

    const section = document.getElementById('why-users-love');
    if (section) {
      observer.observe(section);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <section id="why-users-love" className="relative min-h-screen bg-[#0b0a14] md:bg-[url('/images/glow.png')] bg-cover bg-center overflow-hidden">

      <div className="relative z-10 px-4 py-16 md:py-24 lg:py-32">
        {/* Section Title */}
        <div className="text-center mb-16">
          <h2 className="text-2xl md:text-5xl font-bold bg-white bg-clip-text text-transparent">
            Why Users Love NEFTIT
          </h2>
        </div>

        <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 lg:gap-0 gap-8 lg:items-center">
          {/* Left Features */}
          <div className="space-y-12 flex flex-col items-center md:items-end">
            {leftFeatures.map((feature, index) => (
              <div
                key={index}
                className={`transition-all duration-1000 delay-${index * 200} ${isVisible ? 'animate-fade-in-left' : 'opacity-0 -translate-x-20'
                  }`}
              >
                <div className={`w-[280px] md:w-[350px] lg:w-[450px] h-[150px] lg:ml-auto bg-[#121021] backdrop-blur-lg rounded-3xl p-6 shadow-lg border border-[#292460] animate-float group hover:shadow-[#5d43ef]/20 transition-all relative ${index === 1 ? 'lg:mr-12' : ''
                  }`}>
                  <div className="absolute -top-3 left-[110px] md:-left-3 w-12 h-12 rounded-full bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] flex items-center justify-center text-white flex-shrink-0">
                    <feature.icon />
                  </div>
                  <div className="pt-4">
                    <h3 className="text-lg md:text-xl font-bold text-white mb-2 group-hover:text-[#5d43ef] transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-sm md:text-lg text-gray-300 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Center Character */}
          <div className={`hidden lg:flex justify-center transition-all duration-1000 delay-600 ${isVisible ? 'animate-fade-in-up' : 'opacity-0 translate-y-20'
            }`}>
            <img
              src="/images/IntroCharacter1.png"
              alt="Users Love Character"
              className="w-96 h-[580px] object-contain"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.7s ease-out, transform 0.7s ease-out'
              }}
            />
          </div>

          {/* Right Features */}
          <div className="space-y-12 flex flex-col items-center md:block">
            {rightFeatures.map((feature, index) => (
              <div
                key={index}
                className={`transition-all duration-1000 ease-out ${index === 0 ? 'delay-0' :
                    index === 1 ? 'delay-200' : 'delay-400'
                  } ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-20'
                  }`}
              >
                <div className={`w-[280px] md:w-[350px] lg:w-[450px] h-[150px] bg-[#121021] backdrop-blur-lg rounded-3xl p-6 shadow-lg border border-[#292460] animate-float group hover:shadow-[#5d43ef]/20 transition-all relative ${index === 1 ? 'lg:ml-12' : ''
                  }`}>
                  <div className="absolute -top-3 right-[110px] md:-right-3 w-12 h-12 rounded-full bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] flex items-center justify-center text-white flex-shrink-0">

                    <feature.icon />

                  </div>
                  <div className="pt-4">
                    <h3 className="text-lg md:text-xl font-bold text-white mb-2 group-hover:text-[#5d43ef] transition-colors md:text-end">
                      {feature.title}
                    </h3>
                    <p className="text-sm md:text-lg text-gray-300 leading-relaxed md:text-end">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </section>
  );
};

export default WhyUsersLoveSection;