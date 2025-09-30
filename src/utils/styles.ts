/**
 * styles.ts - Centralized Tailwind CSS class management
 * 
 * This file contains reusable Tailwind class combinations for consistent styling
 * across the application. Using these constants improves readability and ensures
 * visual consistency.
 */

import { cn } from '@/lib/utils';

/**
 * Card styling variations
 */
export const cardStyles = {
  /** Base card container with dark theme styling */
  container: "flex flex-col p-6 bg-gray-900/90 backdrop-blur-sm rounded-xl border border-gray-800 shadow-xl",
  
  /** Card header styling */
  header: "mb-4",
  
  /** Primary card heading */
  title: "text-xl font-bold text-white mb-1",
  
  /** Secondary card text */
  description: "text-gray-400 text-sm",
  
  /** Card content area */
  content: "space-y-4",
  
  /** Card footer area */
  footer: "mt-4 pt-4 border-t border-gray-800 flex justify-between items-center",
  
  /** Hoverable card variation */
  hoverable: "transition-all duration-300 hover:bg-gray-800/90 hover:border-gray-700 hover:-translate-y-1",
  
  /** Compact card variation with less padding */
  compact: "p-4",
  
  /** Apply multiple card styles with the cn utility */
  apply: (baseStyle: 'container' | 'compact', isHoverable?: boolean) => {
    return cn(
      cardStyles[baseStyle],
      isHoverable && cardStyles.hoverable
    );
  }
};

/**
 * Button styling variations (beyond the component variants)
 */
export const buttonStyles = {
  /** Icon button with rounded styling */
  iconButton: "rounded-full w-10 h-10 flex items-center justify-center",
  
  /** Gradient button background effects */
  gradient: {
    /** Primary blue gradient */
    primary: "bg-gradient-to-r from-blue-500/20 to-blue-700/20 hover:from-blue-500/30 hover:to-blue-700/30 text-blue-500 border-blue-500/50",
    
    /** Success green gradient */
    success: "bg-gradient-to-r from-green-500/20 to-emerald-600/20 hover:from-green-500/30 hover:to-emerald-600/30 text-green-500 border-green-500/50",
    
    /** Warning/flame gradient */
    warning: "bg-gradient-to-r from-orange-500/20 to-red-500/20 hover:from-orange-500/30 hover:to-red-500/30 text-orange-500 border-orange-500/50",
    
    /** Destructive red gradient */
    destructive: "bg-gradient-to-r from-red-600/20 to-red-800/20 hover:from-red-600/30 hover:to-red-800/30 text-red-500 border-red-500/50",
  }
};

/**
 * Layout container styles
 */
export const layoutStyles = {
  /** Main page container */
  pageContainer: "min-h-screen bg-gradient-to-b from-black to-gray-900 text-white",
  
  /** Content container with standard padding */
  contentContainer: "container mx-auto px-4 py-6 md:px-6 lg:px-8",
  
  /** Flex container for card grids */
  cardGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
  
  /** Section container with bottom margin */
  section: "mb-8",
  
  /** Section title */
  sectionTitle: "text-2xl font-bold mb-4",
  
  /** Content divider */
  divider: "border-t border-gray-800 my-6",
};

/**
 * Form related styles
 */
export const formStyles = {
  /** Form container */
  container: "space-y-6",
  
  /** Form section */
  section: "space-y-4 p-6 bg-gray-900/50 rounded-lg border border-gray-800",
  
  /** Form section title */
  sectionTitle: "text-lg font-medium mb-2",
  
  /** Form group for a label and control */
  group: "space-y-2",
  
  /** Form field group in horizontal layout */
  horizontalGroup: "flex flex-col sm:flex-row sm:items-center sm:justify-between sm:space-x-4",
  
  /** Form input error */
  error: "text-sm text-red-500 mt-1",
};

/**
 * Text styles for consistent typography
 */
export const textStyles = {
  /** Page heading */
  h1: "text-3xl font-bold tracking-tight",
  
  /** Section heading */
  h2: "text-2xl font-semibold",
  
  /** Subsection heading */
  h3: "text-xl font-medium",
  
  /** Card or group heading */
  h4: "text-lg font-medium",
  
  /** Large paragraph or intro text */
  lead: "text-xl text-gray-300",
  
  /** Standard paragraph */
  p: "text-gray-300",
  
  /** Small supporting text */
  small: "text-sm text-gray-400",
  
  /** Subtle hint text */
  hint: "text-xs text-gray-500",
  
  /** Error message */
  error: "text-sm text-red-500",
  
  /** Success message */
  success: "text-sm text-green-500",
}; 