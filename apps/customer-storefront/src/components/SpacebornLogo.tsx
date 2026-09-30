'use client';
import React from 'react';

interface SpacebornLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  theme?: 'dark' | 'light' | 'mono';
  subtitle?: boolean;
}

export const SpacebornLogo: React.FC<SpacebornLogoProps> = ({
  size = 'md',
  className = '',
  theme = 'light',
}) => {
  const heightMap = {
    xs: 'h-4',
    sm: 'h-5 sm:h-6',
    md: 'h-6 sm:h-7',
    lg: 'h-8 sm:h-9',
    xl: 'h-10 sm:h-12',
  };

  // The official Spaceborn transparent logo contains white artwork.
  // When displayed on light surfaces (like our warm cream theme), we darken it so it's crisp and high-contrast.
  // On dark surfaces, it remains naturally white.
  const filterClass = theme === 'dark' 
    ? '' 
    : 'brightness-0 opacity-85 hover:opacity-100 transition-opacity';

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <img
        src="https://res.cloudinary.com/kpa1wv3h/image/upload/v1783382894/spaceborn_assets/spaceborn-transparent-logo.png"
        alt="Spaceborn Logo"
        className={`${heightMap[size]} w-auto max-w-[200px] sm:max-w-none object-contain ${filterClass}`}
        loading="eager"
      />
    </div>
  );
};
