import { ReactNode } from "react";
import { MainNav } from "./MainNav";
import { Footer } from "@/components/layout/Footer";
import classNames from "classnames";
import { useLocation } from "react-router-dom";

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export function Layout({ children, className }: LayoutProps) {
  const location = useLocation();
  const hideFooter = location.pathname === "/activity" || location.pathname === "/how-it-works" || location.pathname === "/edit-profile" || location.pathname === "/profile";
  return (
    <div className={classNames("min-h-screen flex flex-col", className)}>
      <MainNav />
      <main className={classNames(
        "flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent",
        "hover:scrollbar-thumb-white/20",
        className?.includes('pt-0') ? 'pt-0' : 'pt-[72px]',
        className
      )}>
        {children}
      </main>
      {/* Conditionally render Footer */}
      {!hideFooter && <Footer />}
    </div>
  );
}
