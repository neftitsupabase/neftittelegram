import React, { useEffect, useRef } from "react";
import clsx from "clsx";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

type ScrollPlaneProps = {
  variant?: "full" | "inline";
  side?: "left" | "right";
  className?: string;
  planeClassName?: string;
  scrollLength?: string | number;
  pin?: boolean;
  raiseOnEnd?: boolean;
  endZIndex?: number;
  startZIndex?: number;
  raiseThreshold?: number;
};

const ScrollPlane: React.FC<ScrollPlaneProps> = ({
  variant = "full",
  side = "left",
  className,
  planeClassName,
  scrollLength,
  pin,
  raiseOnEnd,
  endZIndex,
  startZIndex,
  raiseThreshold,
}) => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const planeRef = useRef<HTMLDivElement | null>(null);
  const pathTopRef = useRef<HTMLDivElement | null>(null);
  const pathBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sectionRef.current || !planeRef.current) return;

    gsap.set(planeRef.current, { xPercent: -50, yPercent: -50 });

    const startPos =
      variant === "full"
        ? "top top"
        : (pin ?? false) ? "top top" : "top bottom";
    const endPos =
      variant === "full"
        ? "bottom bottom"
        : scrollLength ?? "+=150%";

    // Plane follows path
    gsap.to(planeRef.current, {
      scrollTrigger: {
        trigger: sectionRef.current,
        start: startPos,
        end: endPos,
        scrub: true,
        pin: pin ?? (variant === "full" ? true : false),
        anticipatePin: 1,
      },
      ease: "none",
      motionPath: {
        path: "#planePath",
        align: "#planePath",
        alignOrigin: [0.5, 0.5],
        autoRotate: true
      }
    });

    // Fade the plane near the end
    // const fadeStartProgress = 0.9;
    // ScrollTrigger.create({
    //   trigger: sectionRef.current,
    //   start: startPos,
    //   end: endPos,
    //   onUpdate: (self) => {
    //     const ratio = gsap.utils.clamp(0, 1, (self.progress - fadeStartProgress) / (1 - fadeStartProgress));
    //     gsap.set(planeRef.current, { opacity: 1 - ratio });
    //   }
    // });

    // Function to set up dynamic trail effect
    const setupDynamicTrail = (container: HTMLDivElement | null) => {
      if (!container) return;
      const paths = container.querySelectorAll("path");
      paths.forEach((pathEl) => {
        const totalLength = (pathEl as SVGPathElement).getTotalLength();
        const trailLength = 600; // Adjust this for longer/shorter trail

        gsap.set(pathEl, {
          strokeDasharray: `${trailLength} ${totalLength}`,
          strokeDashoffset: totalLength
        });

        gsap.to(pathEl, {
          strokeDashoffset: totalLength - trailLength,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current!,
            start: startPos,
            end: endPos,
            scrub: true
          }
        });
      });
    };

    // Apply dynamic trails to both top and bottom path groups
    setupDynamicTrail(pathTopRef.current);
    setupDynamicTrail(pathBottomRef.current);

    // Raise on end
    if (raiseOnEnd ?? (variant === "inline")) {
      const threshold = raiseThreshold ?? 0.9;
      const zStart = startZIndex ?? 0;
      const zEnd = endZIndex ?? 30;
      gsap.set(sectionRef.current, { zIndex: zStart });
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: startPos,
        end: endPos,
        onUpdate: (self) => {
          const z = self.progress >= threshold ? zEnd : zStart;
          gsap.set(sectionRef.current, { zIndex: z });
        },
      });
    }
  }, [variant, pin, raiseOnEnd, endZIndex, startZIndex, raiseThreshold, scrollLength]);

  const sidePos = side === "right" ? "right-0" : "left-0";
  const containerBase =
    variant === "full"
      ? "relative min-h-[200vh] scroll-smooth-breeze overflow-hidden"
      : "relative h-[420px] md:h-[500px] overflow-visible";
  const rootClass = clsx(containerBase, className);
  const computedPlaneSize =
    planeClassName ?? (variant === "full" ? "w-80 h-80" : "w-40 h-40 md:w-64 md:h-64");

  return (
    <section ref={sectionRef} className={rootClass} data-block="scroll-smooth-breeze">
      {/* Invisible path for plane to follow */}
      <div id="scroll-plane-path-core" className={clsx("absolute top-0 w-full md:w-1/2 z-10 opacity-0", sidePos)}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 997 822">
          <path
            id="planePath"
            stroke="transparent"
            strokeLinecap="round"
            strokeMiterlimit="10"
            strokeWidth="4"
            d="M-92 17.713c154.32 237.253 348.7 486.913 585.407 466.93 137.542-17.257 247.733-123.595 279.259-239.307 27.368-100.43-21.323-229.59-140.017-241.76-118.693-12.172-208.268 98.897-231.122 199.803-34.673 151.333 12.324 312.301 125.096 429.074C639.395 749.225 815.268 819.528 995 819"
          />
        </svg>
      </div>

      {/* Dynamic trail - top */}
      <div ref={pathTopRef} className={clsx("absolute top-0 w-full md:w-1/2 z-20", sidePos)}>
        {/* Keep your gradient SVG from before */}
        {/* ...SVG content unchanged... */}
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 997 822" aria-hidden="true">
          <defs>
            <linearGradient
              id="paint0_linear"
              x1="722.156"
              x2="92.39"
              y1="-228.339"
              y2="704.889"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#5d43ef" />
              <stop offset="0.5" stopColor="#1b1930" />
              <stop offset="1" stopColor="#121021" />
            </linearGradient>
          </defs>
          {/* Primary trail */}
          <path
            stroke="url(#paint0_linear)"
            strokeLinecap="round"
            strokeMiterlimit="10"
            strokeWidth="3"
            opacity="0.8"
            d="M-92 17.713c154.32 237.253 348.7 486.913 585.407 466.93 137.542-17.257 247.733-123.595 279.259-239.307 27.368-100.43-21.323-229.59-140.017-241.76-118.693-12.172-208.268 98.897-231.122 199.803-34.673 151.333 12.324 312.301 125.096 429.074C639.395 749.225 815.268 819.528 995 819"
          />
          {/* Secondary trail - slightly offset */}
          <path
            stroke="url(#paint0_linear)"
            strokeLinecap="round"
            strokeMiterlimit="10"
            strokeWidth="2"
            opacity="0.6"
            d="M-90 19.713c154.32 237.253 348.7 486.913 585.407 466.93 137.542-17.257 247.733-123.595 279.259-239.307 27.368-100.43-21.323-229.59-140.017-241.76-118.693-12.172-208.268 98.897-231.122 199.803-34.673 151.333 12.324 312.301 125.096 429.074C639.395 749.225 815.268 819.528 995 819"
          />
          {/* Tertiary trail - more offset */}
          <path
            stroke="url(#paint0_linear)"
            strokeLinecap="round"
            strokeMiterlimit="10"
            strokeWidth="1.5"
            opacity="0.4"
            d="M-88 21.713c154.32 237.253 348.7 486.913 585.407 466.93 137.542-17.257 247.733-123.595 279.259-239.307 27.368-100.43-21.323-229.59-140.017-241.76-118.693-12.172-208.268 98.897-231.122 199.803-34.673 151.333 12.324 312.301 125.096 429.074C639.395 749.225 815.268 819.528 995 819"
          />
        </svg>

      </div>

      {/* Dynamic trail - bottom */}
      <div ref={pathBottomRef} className={clsx("absolute top-0 w-full md:w-1/2 z-0", sidePos)}>
        {/* Keep your gradient SVG from before */}
        {/* ...SVG content unchanged... */}
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 997 822" aria-hidden="true">
          <defs>
            <linearGradient
              id="paint0_linear"
              x1="722.156"
              x2="92.39"
              y1="-228.339"
              y2="704.889"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#5d43ef" />
              <stop offset="0.5" stopColor="#1b1930" />
              <stop offset="1" stopColor="#121021" />
            </linearGradient>
          </defs>
          {/* Background trail 1 */}
          <path
            stroke="url(#paint0_linear)"
            strokeLinecap="round"
            strokeMiterlimit="10"
            strokeWidth="2"
            opacity="0.3"
            d="M-94 15.713c154.32 237.253 348.7 486.913 585.407 466.93 137.542-17.257 247.733-123.595 279.259-239.307 27.368-100.43-21.323-229.59-140.017-241.76-118.693-12.172-208.268 98.897-231.122 199.803-34.673 151.333 12.324 312.301 125.096 429.074C639.395 749.225 815.268 819.528 995 819"
          />
          {/* Background trail 2 */}
          <path
            stroke="url(#paint0_linear)"
            strokeLinecap="round"
            strokeMiterlimit="10"
            strokeWidth="1"
            opacity="0.2"
            d="M-96 13.713c154.32 237.253 348.7 486.913 585.407 466.93 137.542-17.257 247.733-123.595 279.259-239.307 27.368-100.43-21.323-229.59-140.017-241.76-118.693-12.172-208.268 98.897-231.122 199.803-34.673 151.333 12.324 312.301 125.096 429.074C639.395 749.225 815.268 819.528 995 819"
          />
        </svg>

      </div>

      {/* Plane */}
      <div id="scroll-plane" className={clsx("absolute top-0 z-50 pointer-events-none", sidePos, computedPlaneSize)}>
        {/* Animated wrapper so both SVG and Image follow the path */}
        <div ref={planeRef} className="w-full h-full">
          {/* Keep previous plane SVG (hidden visually but preserved for reference) */}
          <svg
            className="hidden"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            fill="none"
            viewBox="0 0 309 152"
            aria-hidden="true"
          >
            <g>
              <path
                fill="#5d43ef"
                d="m82.78 35.086 215.877 94.559L79 92l3.78-56.914Z"
              />
              <path
                fill="url(#paint0_linear_plane)"
                d="m82.78 35.086 215.877 94.559L79 92l3.78-56.914Z"
              />
              <path
                fill="url(#pattern-scroll-smooth-plane-0)"
                fillOpacity=".34"
                d="m82.78 35.086 215.877 94.559L79 92l3.78-56.914Z"
              />
              <path
                fill="url(#paint1_linear_plane)"
                d="m82.781 35.085 52.044-23.564 163.833 118.123-215.877-94.56Z"
              />
              <path
                fill="url(#pattern-scroll-smooth-plane-1)"
                fillOpacity=".6"
                d="m82.781 35.085 52.044-23.564 163.833 118.123-215.877-94.56Z"
                style={{ mixBlendMode: "multiply" }}
              />
            </g>
            <g>
              <path
                fill="url(#paint2_linear_plane)"
                d="M76.828 107.147 291.17 126.73l-216.516 4.229 2.175-23.812Z"
              />
              <path
                fill="#121021"
                fillOpacity=".2"
                d="M76.828 107.147 291.17 126.73l-216.516 4.229 2.175-23.812Z"
              />
              <path
                fill="url(#paint3_linear_plane)"
                d="M76.828 107.147 291.17 126.73l-216.516 4.229 2.175-23.812Z"
              />
              <path
                fill="url(#pattern-scroll-smooth-plane-2)"
                fillOpacity=".34"
                d="M76.828 107.147 291.17 126.73l-216.516 4.229 2.175-23.812Z"
              />
              <path
                fill="url(#paint4_linear_plane)"
                d="M298.777 130.425 1.903 103.302l53.998-44.957 242.876 72.08Z"
              />
              <path
                fill="url(#pattern-scroll-smooth-plane-3)"
                fillOpacity=".6"
                d="M298.777 130.425 1.903 103.302l53.998-44.957 242.876 72.08Z"
                style={{ mixBlendMode: "multiply" }}
              />
            </g>
            <defs>
              <linearGradient
                id="paint0_linear_plane"
                x1="154.593"
                x2="160.643"
                y1="48.892"
                y2="131.658"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0" stopColor="#5d43ef" />
                <stop offset="1" stopColor="#1b1930" />
              </linearGradient>
              <linearGradient
                id="paint1_linear_plane"
                x1="66.623"
                x2="112.939"
                y1="2.042"
                y2="199.069"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0" stopColor="#5d43ef" />
                <stop offset="1" stopColor="#121021" />
              </linearGradient>
              <linearGradient
                id="paint2_linear_plane"
                x1="112.454"
                x2="109.954"
                y1="132.998"
                y2="94.498"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#1b1930" />
                <stop offset="1" stopColor="#121021" />
              </linearGradient>
              <linearGradient
                id="paint3_linear_plane"
                x1="246.499"
                x2="260.599"
                y1="203"
                y2="92.441"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0" stopColor="#5d43ef" />
                <stop offset="1" stopColor="#1b1930" />
              </linearGradient>
              <linearGradient
                id="paint4_linear_plane"
                x1="-18.792"
                x2="-15.789"
                y1="49.95"
                y2="152.351"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0" stopColor="#5d43ef" />
                <stop offset="1" stopColor="#121021" />
              </linearGradient>
              {/* Noise patterns for texture */}
              <pattern
                id="pattern-scroll-smooth-plane-0"
                width="1"
                height="1"
                patternContentUnits="objectBoundingBox"
              >
                <rect width="1" height="1" fill="url(#noise)" opacity="0.1" />
              </pattern>
              <pattern
                id="pattern-scroll-smooth-plane-1"
                width=".895"
                height="1.947"
                patternContentUnits="objectBoundingBox"
              >
                <rect width="1" height="1" fill="url(#noise)" opacity="0.15" />
              </pattern>
              <pattern
                id="pattern-scroll-smooth-plane-2"
                width="1"
                height="1"
                patternContentUnits="objectBoundingBox"
              >
                <rect width="1" height="1" fill="url(#noise)" opacity="0.1" />
              </pattern>
              <pattern
                id="pattern-scroll-smooth-plane-3"
                width=".671"
                height="4.025"
                patternContentUnits="objectBoundingBox"
              >
                <rect width="1" height="1" fill="url(#noise)" opacity="0.15" />
              </pattern>
              {/* Simple noise texture */}
              <filter id="noise">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.8"
                  numOctaves="4"
                  stitchTiles="stitch"
                />
              </filter>
            </defs>
          </svg>

          {/* Rocket image (visible) */}
          <img
            src="/images/rocket.png"
            alt="Rocket"
            className="w-full h-full object-contain"
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  );
};

export default ScrollPlane;
