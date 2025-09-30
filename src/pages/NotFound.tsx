import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Enhanced Background */}
      <div className="fixed inset-0">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        <div className="absolute inset-0 bg-gradient-to-tr from-[#FF3BFF]/5 via-[#36F9F6]/5 to-[#5C24FF]/5 backdrop-blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
      </div>

      {/* Decorative Elements */}
      <motion.div
        className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl"
        animate={{
          background: [
            "rgba(255,59,255,0.1)",
            "rgba(54,249,246,0.1)",
            "rgba(92,36,255,0.1)",
            "rgba(255,59,255,0.1)",
          ],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      <motion.div
        className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full blur-3xl"
        animate={{
          background: [
            "rgba(54,249,246,0.1)",
            "rgba(92,36,255,0.1)",
            "rgba(255,59,255,0.1)",
            "rgba(54,249,246,0.1)",
          ],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      
      {/* Glass Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className={cn(
          "relative px-12 py-16 rounded-3xl text-center",
          "bg-background-card/30 backdrop-blur-xl",
          "border border-border/50",
          "transition-all duration-500",
          "hover:border-[#FF3BFF]/20",
          "hover:shadow-lg hover:shadow-[#FF3BFF]/5",
          "overflow-hidden",
          "group"
        )}
      >
        {/* Animated Gradient Background */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          initial={false}
          animate={{
            background: [
              "linear-gradient(to right, rgba(255,59,255,0.05), rgba(54,249,246,0.05))",
              "linear-gradient(to left, rgba(255,59,255,0.05), rgba(54,249,246,0.05))",
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />

        {/* Glass Overlay */}
        <div className="absolute inset-0 bg-background-card/80 backdrop-blur-sm" />

        {/* Content */}
        <div className="relative z-10 space-y-8">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className={cn(
              "mx-auto mb-8 w-24 h-24 rounded-2xl",
              "bg-gradient-to-r from-[#FF3BFF] via-[#36F9F6] to-[#5C24FF]",
              "flex items-center justify-center",
              "relative overflow-hidden",
              "group/icon"
            )}
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/icon:opacity-100 transition-opacity duration-500" />
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, -5, 5, -5, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <FileQuestion className="w-12 h-12 text-white" />
            </motion.div>
          </motion.div>

          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <h1 className="text-6xl font-bold font-space-grotesk">
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-[#FF3BFF] via-[#36F9F6] to-[#5C24FF] bg-clip-text text-transparent">
                  404
                </span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-[#FF3BFF]/20 via-[#36F9F6]/20 to-[#5C24FF]/20 blur-2xl"
                  animate={{
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
              </span>
            </h1>
            <p className="text-2xl font-medium font-dm-sans text-text-secondary">
              Oops! Page not found
            </p>
            
            {/* Return Home Button */}
            <motion.a
              href="/"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "relative inline-flex items-center gap-2 mt-8",
                "px-8 py-3 rounded-full",
                "font-medium text-base",
                "transition-all duration-300",
                "bg-gradient-to-r from-[#FF3BFF] via-[#36F9F6] to-[#5C24FF]",
                "text-white",
                "hover:shadow-lg hover:shadow-[#FF3BFF]/20",
                "group/button"
              )}
            >
              <ArrowLeft className="w-5 h-5 transition-transform group-hover/button:-translate-x-1" />
              Return to Home
              <div className="absolute inset-0 bg-gradient-to-r from-[#5C24FF] via-[#FF3BFF] to-[#36F9F6] opacity-0 group-hover/button:opacity-100 transition-opacity duration-500 rounded-full" />
              <span className="relative z-10" />
            </motion.a>
          </motion.div>
        </div>

        {/* Bottom Gradient Line */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FF3BFF] via-[#36F9F6] to-[#5C24FF]"
          initial={{ scaleX: 0 }}
          whileHover={{ scaleX: 1 }}
          transition={{ duration: 0.3 }}
        />
      </motion.div>
    </div>
  );
};

export default NotFound;
