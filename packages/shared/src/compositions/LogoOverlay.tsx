import React from 'react';
import { Img } from 'remotion';

interface LogoOverlayProps {
  logoSrc: string;
  logoX?: number;      // % from left (0-100, default 50 = center)
  logoY?: number;      // % from top (0-100, default 50 = center)
  logoSize?: number;    // % of composition width (default 15)
  logoOpacity?: number; // 0-1 (default 1)
}

export const LogoOverlay: React.FC<LogoOverlayProps> = ({
  logoSrc,
  logoX = 50,
  logoY = 50,
  logoSize = 15,
  logoOpacity = 1,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${logoX}%`,
        top: `${logoY}%`,
        transform: 'translate(-50%, -50%)',
        width: `${logoSize}%`,
        opacity: logoOpacity,
        pointerEvents: 'none',
      }}
    >
      <Img
        src={logoSrc}
        style={{
          width: '100%',
          height: 'auto',
          objectFit: 'contain',
        }}
      />
    </div>
  );
};
