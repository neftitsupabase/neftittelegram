import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const cardData = [
  {
    title: "DAILY REWARDS",
    image: "images/card1.png",
    description: "Earn daily rewards just by being an active part of our ecosystem.",
  },
  {
    title: "Fast Earnings",
    image: "images/card2.png",
    description: "Maximize your rewards quickly with our optimized earning system.",
  },
  {
    title: "Secure Platform",
    image: "images/card3.png",
    description: "Your assets are protected with our state-of-the-art security protocols.",
  },
  {
    title: "Global Community",
    image: "images/card4.png",
    description: "Join a worldwide network of like-minded NFT enthusiasts.",
  }
];

const WhyChooseUsSection = () => {

  const [currentCard, setCurrentCard] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);


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

    const section = document.getElementById('why-choose-us');
    if (section) {
      observer.observe(section);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeatureIndex(prev => (prev === cardData.length - 1 ? 0 : prev + 1));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (

    <section id='why-choose-us' className="relative min-h-screen bg-[url('/images/glow.png')] bg-cover bg-center bg-[#0b0a14] overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-purple-400/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-16 md:py-24 lg:py-32">
        {/* Title Section */}
        <div className="flex items-center justify-center gap-4 md:mb-12">
          <h2 className="text-2xl md:text-5xl font-bold bg-white bg-clip-text text-transparent inline-flex items-center gap-4">
            Why Choose Us
          </h2>
          <img
            src="/images/mark.png"
            alt="Question Mark"
            className="w-12 h-12 md:w-16 md:h-18 object-contain animate-glow"
          />
        </div>

        <div className="flex md:grid md:grid-cols-2 gap-8 items-center">

          {/* Image Section */}
          <div className={`hidden md:flex justify-end transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-20'
            }`}>
            <div className="w-[80%] h-[80%]">
              <img src="/images/WhyChooseUs.png" alt="Why Choose Us" className="w-full h-full" />
            </div>
          </div>

          {/* Card Section */}
          <div className={`flex flex-col justify-center lg:justify-center items-center w-full h-full pt-4 mt-8 transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-20'
            }`}>


            <div className="relative flex items-center justify-center w-full h-full mt-10 ">
              {/* Previous Image (shadow effect) */}
              <img
                src={cardData[(currentFeatureIndex - 1 + cardData.length) % cardData.length].image}
                alt="Previous"
                className="absolute w-[40%] h-[60%] left-1/3 md:left-1/2 transform -translate-x-full scale-90 opacity-30 blur-sm transition-all duration-100"
              />

              {/* Current Image */}
              <img
                src={cardData[currentFeatureIndex].image}
                alt={cardData[currentFeatureIndex].title}
                className="z-10 w-[70%] md:w-[60%] h-full object-contain transition-all duration-100"
              />

              {/* Next Image (shadow effect) */}
              <img
                src={cardData[(currentFeatureIndex + 1) % cardData.length].image}
                alt="Next"
                className="absolute right-1/3 md:right-1/2 w-[40%] h-[60%] transform translate-x-full scale-90 opacity-30 blur-sm transition-all duration-100"
              />

            </div>
            <div className="mt-5">
              <p className="text-center text:md md:text-lg font-sora font-medium text-[#FFFFFF]">
                {cardData[currentFeatureIndex].description}
              </p>
            </div>


            {/* Dots */}
            <div className="flex justify-center space-x-2 mt-12">
              {cardData.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentFeatureIndex(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${i === currentFeatureIndex ? "w-4 bg-[#5D43EF]" : "w-2 bg-[#5D43EF]/20 hover:bg-[#5D43EF]/10"}`}
                  aria-label={`Go to feature ${i + 1}`}
                />
              ))}
            </div>

            {/* Arrows */}
            <div className="absolute top-[45%] left-2 right-2 md:top-[40%] md:left-8 md:right-8 lg:top-1/2 lg:left-12 lg:right-12 -translate-y-1/2 flex justify-between">
              <button
                onClick={() => setCurrentFeatureIndex(prev => prev === 0 ? cardData.length - 1 : prev - 1)}
                className="w-10 h-10 rounded-full bg-[##5D43EF]/10 hover:bg-[#5D43EF]/20 text-[#5D43EF] flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentFeatureIndex(prev => prev === cardData.length - 1 ? 0 : prev + 1)}
                className="w-10 h-10 rounded-full bg-[##5D43EF]/10 hover:bg-[#5D43EF]/20 text-[#5D43EF] flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
};

export default WhyChooseUsSection;