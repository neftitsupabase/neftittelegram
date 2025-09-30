import React from 'react';
import { AlertCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Props for ErrorDisplay component
 */
export interface ErrorDisplayProps {
  /** Error message to display */
  error: Error | string | null | unknown;
  /** Optional callback to retry the failed operation */
  onRetry?: () => void;
  /** Visual style variant of the error */
  variant?: 'inline' | 'card' | 'banner' | 'toast' | 'minimal';
  /** Optional additional CSS classes */
  className?: string;
  /** Optional title to display above the error message */
  title?: string;
  /** Optional additional error details for debugging (only shown in development) */
  details?: string;
  /** Whether to show a retry button (requires onRetry to be provided) */
  showRetry?: boolean;
}

/**
 * Safely extracts an error message from various error types
 */
const getErrorMessage = (error: Error | string | null | unknown): string => {
  if (!error) return 'An unknown error occurred';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    // Try to extract message property if it exists
    if ('message' in error && typeof (error as any).message === 'string') {
      return (error as any).message;
    }
  }
  return 'An unexpected error occurred';
};

/**
 * ErrorDisplay - A component for displaying errors with consistent styling
 * 
 * Provides multiple visual variants for different contexts such as inline validation,
 * full error cards, banners, and toast-style messages.
 * 
 * @example
 * <ErrorDisplay 
 *   error={error} 
 *   onRetry={handleRetry} 
 *   variant="card" 
 *   title="Authentication Failed"
 * />
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  variant = 'inline',
  className,
  title,
  details,
  showRetry = true,
}) => {
  // Skip rendering if no error
  if (!error) return null;
  
  const errorMessage = getErrorMessage(error);
  const isDev = process.env.NODE_ENV === 'development';
  
  // Icons for different variants
  const iconMap = {
    inline: <AlertCircle className="w-4 h-4" />,
    card: <XCircle className="w-6 h-6" />,
    banner: <AlertTriangle className="w-5 h-5" />,
    toast: <AlertCircle className="w-4 h-4" />,
    minimal: null,
  };
  
  // Different styling based on variant
  switch (variant) {
    case 'inline':
      return (
        <div className={cn(
          "flex items-center text-red-500 text-sm gap-1.5",
          className
        )}>
          {iconMap.inline}
          <span>{errorMessage}</span>
          {showRetry && onRetry && (
            <button 
              onClick={onRetry}
              className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2 ml-1"
            >
              Retry
            </button>
          )}
        </div>
      );
      
    case 'card':
      return (
        <div className={cn(
          "p-4 bg-red-500/10 border border-red-500/30 rounded-lg",
          className
        )}>
          <div className="flex items-start gap-3">
            <div className="text-red-500 mt-0.5">
              {iconMap.card}
            </div>
            <div className="flex-1">
              {title && (
                <h4 className="font-semibold text-red-500 mb-1">{title}</h4>
              )}
              <p className="text-red-200/90">{errorMessage}</p>
              
              {isDev && details && (
                <details className="mt-2">
                  <summary className="text-xs text-red-300/70 cursor-pointer">
                    Technical details
                  </summary>
                  <pre className="mt-2 p-2 text-xs bg-red-950/50 text-red-200/70 rounded overflow-auto">
                    {details}
                  </pre>
                </details>
              )}
              
              {showRetry && onRetry && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onRetry}
                  className="mt-3 bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                >
                  <RefreshCw className="w-3 h-3 mr-2" />
                  Try Again
                </Button>
              )}
            </div>
          </div>
        </div>
      );
      
    case 'banner':
      return (
        <div className={cn(
          "w-full p-3 bg-red-500/10 border-l-4 border-red-500",
          className
        )}>
          <div className="flex items-center gap-3">
            <div className="text-red-500">
              {iconMap.banner}
            </div>
            <div className="flex-1">
              {title && (
                <h4 className="font-medium text-red-500 text-sm">{title}</h4>
              )}
              <p className="text-red-200/90 text-sm">{errorMessage}</p>
            </div>
            {showRetry && onRetry && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onRetry}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <RefreshCw className="w-3 h-3 mr-2" />
                Retry
              </Button>
            )}
          </div>
        </div>
      );
      
    case 'toast':
      return (
        <div className={cn(
          "flex items-center p-2 bg-red-950 border border-red-800 rounded shadow-lg text-sm",
          className
        )}>
          <div className="text-red-500 mr-2">
            {iconMap.toast}
          </div>
          <span className="text-red-200">{errorMessage}</span>
        </div>
      );
      
    case 'minimal':
      return (
        <p className={cn("text-red-500 text-sm", className)}>
          {errorMessage}
        </p>
      );
      
    default:
      return <p className="text-red-500">{errorMessage}</p>;
  }
};

export default ErrorDisplay; 