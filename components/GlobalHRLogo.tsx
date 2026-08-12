import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  activeBrand?: string;
  hideText?: boolean;
  stacked?: boolean;
}

export default function GlobalHRLogo({ className = '', size = 'md', activeBrand, hideText = false, stacked = false }: LogoProps) {
  const heightClass = size === 'sm' ? 'h-12' : size === 'lg' ? 'h-28' : 'h-16';
  
  return (
    <div className={`flex items-center ${className}`}>
      <img
        src="/global-hr-logo.png"
        alt="Global HR Logo"
        className={`${heightClass} w-auto object-contain`}
      />
    </div>
  );
}
