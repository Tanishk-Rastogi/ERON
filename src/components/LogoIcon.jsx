import React from 'react';

export function LogoIcon({ className = "w-9 h-9" }) {
  return (
    <div className={`${className} bg-black rounded-xl flex items-center justify-center p-1.5 shadow-sm flex-shrink-0`}>
      <svg 
        viewBox="0 0 100 100" 
        fill="none" 
        stroke="currentColor" 
        className="w-full h-full text-white"
        style={{ strokeWidth: 10, strokeLinecap: 'round', strokeLinejoin: 'round' }}
      >
        {/* Exact pulse wave geometry matching logo: flat left -> high peak -> deep trough -> recovery -> flat right */}
        <path d="M 12 50 L 32 50 L 46 22 L 64 78 L 76 50 L 88 50" />
      </svg>
    </div>
  );
}
