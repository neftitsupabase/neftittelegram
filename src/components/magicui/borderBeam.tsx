"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { Transition } from "framer-motion";
import React from "react";

interface BorderBeamProps {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  transition?: Transition;
  className?: string;
  style?: React.CSSProperties;
  reverse?: boolean;
  initialOffset?: number; // 0-100
  borderWidth?: number;
  // New: motion mode
  mode?: "perimeter" | "diagonal";
}

export const BorderBeam = ({
  className,
  size = 56,
  delay = 0,
  duration = 6,
  colorFrom = "#FF96F9",
  colorTo = "#FFE9FE",
  transition,
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 2,
  mode = "perimeter",
}: BorderBeamProps) => {
  // Diagonal single beam from top-left to bottom-right
  if (mode === "diagonal") {
    return (
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden">
        <motion.div
          className={cn(
            "absolute aspect-square rounded-full",
            // Gradient that fades to transparent along movement direction
            "bg-gradient-to-r from-[var(--color-from)] via-[var(--color-to)] to-transparent",
            "[filter:drop-shadow(0_0_10px_rgba(255,150,249,0.55))]",
            className
          )}
          style={{
            width: size,
            // rotate square so gradient travels diagonally
            ...({ rotate: 45 } as any),
            ...({ ["--color-from"]: colorFrom } as any),
            ...({ ["--color-to"]: colorTo } as any),
            ...style,
          }}
          initial={{
            // start just outside top-left
            x: -size,
            y: -size,
          }}
          animate={{
            // move to just outside bottom-right
            x: reverse ? -size : `calc(100% + ${size}px)`,
            y: reverse ? -size : `calc(100% + ${size}px)`,
          }}
          transition={{ repeat: Infinity, ease: "linear", duration, delay: -delay, ...transition }}
        />
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
      style={{ borderWidth, borderStyle: "solid" }}
    >
      <motion.div
        className={cn(
          "absolute aspect-square rounded-full",
          "bg-gradient-to-l from-[var(--color-from)] via-[var(--color-to)] to-transparent",
          "[filter:drop-shadow(0_0_10px_rgba(255,150,249,0.55))]",
          className
        )}
        style={{
          width: size,
          // offsetPath is not in React.CSSProperties typings; cast to any
          ...({ offsetPath: `rect(0 auto auto 0 round ${size}px)` } as any),
          // CSS variables for gradient colors
          ...({ ["--color-from"]: colorFrom } as any),
          ...({ ["--color-to"]: colorTo } as any),
          ...style,
        }}
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`],
        }}
        transition={{ repeat: Infinity, ease: "linear", duration, delay: -delay, ...transition }}
      />
    </div>
  );
};

export default BorderBeam;


