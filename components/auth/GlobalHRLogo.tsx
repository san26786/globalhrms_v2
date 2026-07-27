"use client";
import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  activeBrand?: string;
  hideText?: boolean;
  stacked?: boolean;
}

export default function GlobalHRLogo({ className = '', size = 'md', activeBrand, hideText = false, stacked = false }: LogoProps) {
  const widthClass = size === 'sm' ? 'h-8' : size === 'lg' ? 'h-16' : 'h-12';

  const getBrandBadge = (brand: string) => {
    if (brand.includes('India')) return 'INDIA';
    if (brand.includes('UK')) return 'UK REGION';
    if (brand.includes('USA')) return 'USA CORP';
    if (brand.includes('Demo')) return 'DEMO ENT';
    if (brand.includes('Nexus')) return 'NEXUS';
    return 'MAIN';
  };
  
  return (
    <div className={`flex ${stacked ? 'flex-col items-center justify-center gap-1.5 text-center' : 'items-center gap-3'} ${className}`}>
      {/* Visual Globe Emblem */}
      <svg
        viewBox="0 0 100 100"
        className={`${stacked ? 'h-9' : widthClass} aspect-square shrink-0`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Globe Base Shadow / Glow */}
        <circle cx="50" cy="50" r="45" fill="none" />
        
        {/* Top Wave: Blue */}
        <path
          d="M15 42C30 30 70 30 85 42C75 22 25 22 15 42Z"
          fill="#1d4ed8"
        />
        
        {/* Mid Top Wave: Cyan/Light Blue */}
        <path
          d="M10 52C28 40 72 40 90 52C82 34 18 34 10 52Z"
          fill="#3b82f6"
        />
        
        {/* Middle Divider: White spacing implicitly */}
        
        {/* Mid Bottom Wave: Orange */}
        <path
          d="M8 62C26 50 74 50 92 62C84 46 16 46 8 62Z"
          fill="#f97316"
        />
        
        {/* Bottom Wave: Dark Orange/Red */}
        <path
          d="M15 72C30 64 70 64 85 72C75 58 25 58 15 72Z"
          fill="#ea580c"
        />
        
        {/* Decorative Grid Lines */}
        <path
          d="M50 5 A45 45 0 0 0 50 95"
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          opacity="0.4"
        />
        <path
          d="M5 50 A45 45 0 0 0 95 50"
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          opacity="0.4"
        />
      </svg>

      {/* Brand Typographic Marks */}
      {!hideText && (
        <div className={`flex flex-col select-none leading-none ${stacked ? 'items-center mt-1' : ''}`}>
          <div className={`flex items-center font-display font-black text-slate-800 tracking-tight leading-none ${
            stacked ? 'text-[11px] sm:text-[11px] md:text-[11px]' : 'text-lg sm:text-xl md:text-2xl'
          }`}>
            <span>GL</span>
            <span className="inline-flex items-center justify-center mx-0.5 w-[0.85em] h-[0.85em] shrink-0">
              <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="46" fill="#0ea5e9" />
                <path d="M32 32 A 25 25 0 1 0 68 32" stroke="white" strokeWidth="12" strokeLinecap="round" />
                <line x1="50" y1="16" x2="50" y2="46" stroke="white" strokeWidth="12" strokeLinecap="round" />
              </svg>
            </span>
            <span>BAL</span>
            <span className={`text-[#0ea5e9] font-extrabold align-super ml-0.5 relative ${
              stacked ? 'text-[7px] -top-0.5 sm:-top-0.5' : 'text-[10px] sm:text-[13px] -top-1 sm:-top-1.5'
            }`}>
              HR
            </span>
            <span className={`text-[6px] text-slate-400 font-semibold ml-0.5 align-super relative ${
              stacked ? 'hidden' : '-top-0.5'
            }`}>
              TM
            </span>
          </div>
          <div className={`flex items-center mt-1 ${stacked ? 'flex-col gap-0.5' : 'justify-between gap-2'}`}>
            <div className="text-[6px] sm:text-[7px] font-black text-orange-600 tracking-[0.05em] uppercase whitespace-nowrap">
              PROGRESS STARTS INSIDE.
            </div>
            {!stacked && (
              <span className="text-[6px] sm:text-[7px] font-black text-white bg-gradient-to-r from-blue-600 to-sky-500 px-1 py-0.5 rounded uppercase leading-none shrink-0">
                {getBrandBadge(activeBrand || 'Global HR India Ltd')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
