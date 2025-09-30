import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

type HowItWorksSectionProps = {
  mascotSrc?: string; // optional custom mascot image path (from public/)
};

/**
 * Scroll-driven "How It Works" section with a mascot/ball traveling along a curvy path.
 * Layout alternates Left → Right → Left → Right for the four step cards.
 */
export function HowItWorksSection({ mascotSrc }: HowItWorksSectionProps) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const mascotRef = useRef<HTMLDivElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const step1Ref = useRef<HTMLDivElement | null>(null);
  const step2Ref = useRef<HTMLDivElement | null>(null);
  const step3Ref = useRef<HTMLDivElement | null>(null);
  const step4Ref = useRef<HTMLDivElement | null>(null);

  const [svgSize, setSvgSize] = useState<{ width: number; height: number }>(
    { width: 1200, height: 1600 }
  );
  const [pathD, setPathD] = useState<string>("");

  function buildRightAnglePath(points: Array<{ x: number; y: number }>): string {
    if (points.length === 0) return "";

    const d: string[] = [];
    d.push(`M ${points[0].x} ${points[0].y}`);

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];

      const r = 500; // radius of rounding
      // Move horizontally but stop before corner
      d.push(`L ${p1.x - Math.sign(p1.x - p0.x) * r} ${p0.y}`);
      // Curve around the corner
      d.push(`Q ${p1.x} ${p0.y}, ${p1.x} ${p0.y + Math.sign(p1.y - p0.y) * r}`);
      // Continue vertically
      d.push(`L ${p1.x} ${p1.y}`);
    }

    return d.join(" ");
  }

  // Compute dynamic path based on actual card positions
  useLayoutEffect(() => {
    const containerEl = overlayRef.current;
    if (
      !containerEl ||
      !step1Ref.current ||
      !step2Ref.current ||
      !step3Ref.current ||
      !step4Ref.current
    ) {
      return;
    }

    const compute = () => {
      const containerRect = containerEl.getBoundingClientRect();
      const r1 = step1Ref.current!.getBoundingClientRect();
      const r2 = step2Ref.current!.getBoundingClientRect();
      const r3 = step3Ref.current!.getBoundingClientRect();
      const r4 = step4Ref.current!.getBoundingClientRect();

      const getCenter = (r: DOMRect) => (r.left + r.right) / 2;

      const p1 = {
        x: getCenter(r1) - containerRect.left,
        y: (r1.top + r1.bottom) / 2 - containerRect.top,
      };

      const p2 = {
        x: getCenter(r2) - containerRect.left,
        y: (r2.top + r2.bottom) / 2 - containerRect.top,
      };

      const p3 = {
        x: getCenter(r3) - containerRect.left,
        y: (r3.top + r3.bottom) / 2 - containerRect.top,
      };

      const p4 = {
        x: getCenter(r4) - containerRect.left,
        y: (r4.top + r4.bottom) / 2 - containerRect.top,
      };

      const newD = buildRightAnglePath([p1, p2, p3, p4]);
      setPathD(newD);
      setSvgSize({ width: containerEl.clientWidth, height: containerEl.clientHeight });
    };

    compute();

    // Observe size changes to recompute path
    const ro = new ResizeObserver(() => compute());
    ro.observe(containerEl);
    step1Ref.current && ro.observe(step1Ref.current);
    step2Ref.current && ro.observe(step2Ref.current);
    step3Ref.current && ro.observe(step3Ref.current);
    step4Ref.current && ro.observe(step4Ref.current);

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!sectionRef.current || !mascotRef.current || !pathRef.current || !pathD) return;

    const ctx = gsap.context(() => {
      const mascotEl = mascotRef.current!;
      const pathEl = pathRef.current!;

      gsap.set(mascotEl, { xPercent: -50, yPercent: -50 });

      // Scroll-triggered motion path
      gsap.to(mascotEl, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top center",
          end: "bottom 80%",
          scrub: true,
          markers: false, // Enable to debug scroll trigger
        },
        motionPath: {
          path: pathEl,
          align: pathEl,
          alignOrigin: [0.5, 0.5],
          autoRotate: false,
          // start: 0.05,
          // end: 1
        },
        ease: "none",
      });

      // Optional: bobbing effect (still works even with scroll)
      gsap.to(mascotEl, {
        scale: 1.05,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        duration: 2.5,
      });

      // Optional: Flip based on direction
      let lastX = 0;
      let lastDirection: "left" | "right" = "right";

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top center",
        end: "bottom center",
        scrub: true,
        onUpdate: (self) => {
          const totalLength = pathEl.getTotalLength();
          const pt = pathEl.getPointAtLength(totalLength * self.progress);

          const deltaX = pt.x - lastX;

          // Use threshold to avoid small movements triggering flip
          if (Math.abs(deltaX) > 1) {
            const newDirection = deltaX > 0 ? "right" : "left";

            if (newDirection !== lastDirection) {
              lastDirection = newDirection;
              const inner = mascotEl.querySelector(".mascot-inner");

              if (inner) {
                gsap.to(inner, {
                  scaleX: newDirection === "right" ? 1 : -1,
                  duration: 0.25,
                  ease: "power2.out",
                });
              }
            }

            lastX = pt.x;
          }
        },
      });

    }, sectionRef);

    return () => ctx.revert();
  }, [pathD]);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative py-24 md:py-32 bg-[#0b0a14] overflow-visible"
    >
      <div className="container mx-auto max-w-6xl px-4">
        <h2 className="text-2xl md:text-5xl font-bold text-center mb-4 bg-clip-text text-transparent bg-white">
          How It Works
        </h2>
        <p className="text-md md:text-lg text-center text-[#94A3B8] max-w-2xl mx-auto mb-16">
          Complete quests, earn NFTs, upgrade them, and showcase your collection.
        </p>

        {/* Content grid with big vertical gaps so the path can weave between cards */}
        <div className="relative overflow-hidden" ref={overlayRef}>
          {/* SVG worm path overlay */}
          <svg
            className="pointer-events-none absolute inset-0 w-full h-full"
            viewBox={`0 0 ${svgSize.width} ${svgSize.height}`}
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Dynamic path that follows the specified edges between cards */}
            <path
              ref={pathRef}
              id="worm-path"
              d={pathD}
              fill="none"
              stroke="#5d43ef"
              strokeWidth="96"
              opacity="0.1"
              filter="url(#glow)"
            />
          </svg>

          {/* Mascot */}
          <div
            id="mascot"
            ref={mascotRef}
            className="absolute top-0 left-0 z-0 hidden md:block"
            style={{ willChange: "transform" }}
          >
            <div className="mascot-inner">
              {mascotSrc ? (

                <img
                  src={mascotSrc}
                  alt="NEFTIT Mascot"
                  className="w-20 h-20 md:w-28 md:h-28 drop-shadow-[0_0_12px_#5d43ef]"
                  draggable={false}
                />

              ) : (
                <div
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full"
                  style={{
                    background:
                      "radial-gradient(50% 50% at 50% 50%, #5FE9FF 0%, #00BAE2 45%, rgba(0,186,226,0.6) 60%, rgba(0,186,226,0.0) 100%)",
                    boxShadow:
                      "0 0 20px rgba(0,186,226,0.9), 0 0 40px rgba(95,233,255,0.6)",
                  }}
                />
              )}
            </div>
          </div>

          {/* Steps grid (alternating) */}
          <div className="flex flex-col items-center md:grid md:grid-cols-1 gap-y-[10vh] md:gap-y-[30vh] relative z-10">
            {/* Step 1 - Left */}
            <StepCard
              step={1}
              title="Complete Quests"
              desc="Join missions across socials, games, and partnered Web3 & Web2 projects. Every action brings you closer to rewards."
              icon="/images/completequests.svg"
              side="left"
              ref={step1Ref}
            />

            {/* Step 2 - Right */}
            <StepCard
              step={2}
              title="Earn NFTs"
              desc="Each quest completed instantly drops a unique NEFTIT NFT — all tied to our mascots and partner ecosystems."
              icon="/images/earnNFTs.svg"
              side="right"
              ref={step2Ref}
            />

            {/* Step 3 - Left */}
            <StepCard
              step={3}
              title="Upgrade NFTs"
              desc="Fuse or burn lower-tier NFTs to unlock more rarest or gold editions with higher utility."
              icon="/images/upgradeNFTs.svg"
              side="left"
              ref={step3Ref}
            />

            {/* Step 4 - Right */}
            <StepCard
              step={4}
              title="Showcase NFTs"
              desc="Keep them in your NEFTIT profile, trade on major marketplaces, or stake for NEFT tokens — your collection, your power."
              icon="/images/showcaseNFTs.svg"
              side="right"
              ref={step4Ref}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

type StepCardProps = {
  step: number;
  title: string;
  desc: string;
  icon: string;
  side: "left" | "right";
};

const StepCard = React.forwardRef<HTMLDivElement, StepCardProps>(
  ({ step, title, desc, icon, side }: StepCardProps, ref) => {
    const contentPadding = (() => {
      switch (step) {
        case 1:
          return "p-0 px-8 md:p-6 md:px-0"; // mascot at right edge
        case 2:
          return "p-0 px-8 md:p-6 md:px-0"; // mascot at top edge
        case 3:
          return "p-0 px-8 md:p-6 md:px-0"; // mascot at right/bottom edge
        case 4:
          return "p-0 px-8 md:p-6 md:px-0"; // mascot at left edge
        default:
          return "";
      }
    })();


    return (
      <div
        ref={ref}
        className={
          "relative flex flex-col items-center justify-center md:block md:p-8 rounded-3xl backdrop-blur-xl w-[280px] h-[250px] md:w-[300px] md:h-[250px] lg:w-[400px] lg:h-[320px]" +
          "shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-colors hover:bg-white/7 " +
          (side === "left" ? "md:mr-auto" : "md:ml-auto")
        }
      >
        {/* Pipe connection stubs - thick greyish connectors */}
        {step === 1 && (
          // Card 1: Exit pipe stub on the right
          <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 w-2 h-[110px] bg-[#4a4a4a] rounded-r-xl shadow-lg"></div>
        )}
        {step === 2 && (
          <>
            {/* Entry pipe stub on the left */}
            <div className="hidden lg:block absolute -top-1 left-[125px] -translate-y-1/2 w-[120px] h-2 bg-[#4a4a4a] rounded-t-xl shadow-lg"></div>
            {/* Exit pipe stub on the bottom */}
            <div className="hidden lg:block absolute top-[75px] -translate-x-1/2 -left-1 w-2 h-[110px] bg-[#4a4a4a] rounded-l-xl shadow-lg"></div>
          </>
        )}
        {step === 3 && (
          <>
            {/* Entry pipe stub on the top */}
            <div className="hidden lg:block absolute -top-1 left-[155px] -translate-y-1/2 w-[120px] h-2 bg-[#4a4a4a] rounded-t-xl shadow-lg"></div>
            {/* Exit pipe stub on the right */}
            <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 w-2 h-[110px] bg-[#4a4a4a] rounded-r-xl shadow-lg"></div>
          </>
        )}
        {step === 4 && (
          // Card 4: Entry pipe stub on the left
          <div className="hidden lg:block absolute -top-1 left-[125px] -translate-y-1/2 w-[120px] h-2 bg-[#4a4a4a] rounded-t-xl shadow-lg"></div>
        )}
        {/* glass highlight */}
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[#121021]" />
        {/* accent tint */}
        <div className="absolute z-10 inset-0 rounded-3xl bg-gradient-to-br from-[#121021] to-[#5d43ef]/10" />
        {/* removed step number per design */}
        <div className={`relative z-20 ${contentPadding}`}>
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <img src={icon} alt="Icon" className="md:hidden w-12 h-12 md:w-16 md:h-18 object-contain animate-glow" />
            <h3 className="text-white text-lg lg:text-2xl font-semibold mb-1">{title}</h3>
          </div>
          <p className="text-[#94A3B8] text-sm lg:text-lg">{desc}</p>
        </div>
      </div>

    );
  }
);
StepCard.displayName = "StepCard";

export default HowItWorksSection;

