/**
 * Login DecorativeCircles
 * 抽取自 index.tsx (P2-9 Phase 179)
 */
import React from 'react';

export const DecorativeCircles: React.FC = () => (
  <svg
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    }}
    viewBox="0 0 600 800"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="450" cy="120" r="200" fill="rgba(255,255,255,0.03)" />
    <circle cx="500" cy="650" r="180" fill="rgba(255,255,255,0.02)" />
    <circle cx="100" cy="500" r="150" fill="rgba(255,255,255,0.025)" />
    <circle cx="350" cy="400" r="300" fill="rgba(255,255,255,0.015)" />
    <line x1="0" y1="200" x2="600" y2="200" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
    <line x1="0" y1="400" x2="600" y2="400" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
    <line x1="0" y1="600" x2="600" y2="600" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
  </svg>
);
