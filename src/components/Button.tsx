import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const variants = {
      primary: 'bg-primary hover:bg-primary-hover text-black font-medium shadow-glow',
      secondary: 'bg-secondary hover:bg-secondary-hover text-white font-medium shadow-glow-secondary',
      outline: 'border-2 border-primary hover:bg-primary/10 text-primary font-medium',
      ghost: 'hover:bg-white/5 text-white/70 hover:text-white font-medium'
    };

    const sizes = {
      sm: 'px-4 py-2 text-sm rounded-xl',
      md: 'px-6 py-3 text-base rounded-xl',
      lg: 'px-8 py-4 text-lg rounded-2xl'
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'relative inline-flex items-center justify-center transition-all duration-200 font-manrope',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-background',
          variants[variant],
          sizes[size],
          isLoading && 'cursor-wait',
          className
        )}
        {...props}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-inherit rounded-xl">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
        <span className={cn('flex items-center gap-2', isLoading && 'opacity-0')}>
          {leftIcon && <span className="inline-flex">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="inline-flex">{rightIcon}</span>}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
