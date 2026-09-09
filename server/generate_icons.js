const fs = require('fs');
const path = require('path');

// Create crisp SVG icons for PWA and favicon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="puGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a" />
      <stop offset="50%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="128" fill="#0b0f19" />
  <rect x="24" y="24" width="464" height="464" rx="104" fill="none" stroke="url(#puGrad)" stroke-width="8" opacity="0.4" />
  
  <!-- Cyber Shield & University Crest -->
  <g transform="translate(106, 80)">
    <!-- Outer Shield -->
    <path d="M150 20 L270 70 C270 210 150 280 150 310 C150 280 30 210 30 70 Z" 
          fill="url(#puGrad)" filter="url(#glow)" opacity="0.9" />
    <!-- Inner Shield Accent -->
    <path d="M150 35 L255 78 C255 198 150 262 150 288 C150 262 45 198 45 78 Z" 
          fill="#0f172a" />
    
    <!-- Cyber Security Circuit & Key -->
    <path d="M150 90 L185 130 L150 170 L115 130 Z" fill="#38bdf8" />
    <circle cx="150" cy="130" r="16" fill="#ffffff" />
    <path d="M150 146 L150 210 M140 180 L160 180 M140 200 L160 200" stroke="#38bdf8" stroke-width="6" stroke-linecap="round" />
    
    <!-- Tech nodes -->
    <circle cx="100" cy="100" r="6" fill="#60a5fa" />
    <circle cx="200" cy="100" r="6" fill="#60a5fa" />
    <path d="M100 100 L115 130 M200 100 L185 130" stroke="#60a5fa" stroke-width="3" stroke-dasharray="4,4" />
  </g>
  
  <!-- Text Label -->
  <text x="256" y="440" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        font-size="28" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="3">
    MISHRA GROUP INSTITUTE
  </text>
  <text x="256" y="475" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        font-size="20" font-weight="600" fill="#38bdf8" text-anchor="middle" letter-spacing="2">
    3CYBER7 • B.TECH
  </text>
</svg>`;

const iconDir = path.join(__dirname, '..', 'public', 'icons');
fs.writeFileSync(path.join(iconDir, 'icon-512.svg'), svgIcon);
fs.writeFileSync(path.join(iconDir, 'icon-192.svg'), svgIcon);
fs.writeFileSync(path.join(iconDir, 'icon-512.png'), svgIcon); // Fallback copy
fs.writeFileSync(path.join(iconDir, 'icon-192.png'), svgIcon);
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), svgIcon);

console.log('[Assets] Created PWA and brand vector icons in public/icons/');
