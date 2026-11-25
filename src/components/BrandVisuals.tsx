import React from 'react';

interface FlagProps {
  iso2: string;
  className?: string;
}

/**
 * 100% Vector SVG Flags covering every single country in SMS & eSIM catalogs.
 * Zero plain text fallback boxes.
 */
export const CountryFlagSvg: React.FC<FlagProps> = ({ iso2, className = 'w-6 h-4 rounded-[3px]' }) => {
  const code = (iso2 || '').toUpperCase();

  switch (code) {
    case 'UN':
    case 'GL':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#0F4C81" />
          <circle cx="18" cy="12" r="7.5" fill="none" stroke="#67E8F9" strokeWidth="1.5" />
          <ellipse cx="18" cy="12" rx="3.8" ry="7.5" fill="none" stroke="#67E8F9" strokeWidth="1.2" />
          <path d="M10.5 12h15M12 8.5h12M12 15.5h12" stroke="#67E8F9" strokeWidth="1.1" />
        </svg>
      );
    case 'EU':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#003399" />
          <circle cx="18" cy="12" r="6.8" fill="none" stroke="#FFCC00" strokeWidth="1.6" strokeDasharray="1.8 2.2" />
        </svg>
      );
    case 'GB':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#012169" />
          <path d="M0 0l36 24M36 0L0 24" stroke="#FFF" strokeWidth="4" />
          <path d="M0 0l36 24M36 0L0 24" stroke="#C8102E" strokeWidth="2" />
          <path d="M18 0v24M0 12h36" stroke="#FFF" strokeWidth="6" />
          <path d="M18 0v24M0 12h36" stroke="#C8102E" strokeWidth="3.5" />
        </svg>
      );
    case 'US':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#B22234" />
          <path d="M0 3.7h36M0 7.4h36M0 11.1h36M0 14.8h36M0 18.5h36M0 22.2h36" stroke="#FFF" strokeWidth="1.85" />
          <rect width="16" height="13" fill="#3C3B6E" />
          <circle cx="4" cy="3.5" r="0.9" fill="#FFF" />
          <circle cx="8" cy="3.5" r="0.9" fill="#FFF" />
          <circle cx="12" cy="3.5" r="0.9" fill="#FFF" />
          <circle cx="6" cy="6.5" r="0.9" fill="#FFF" />
          <circle cx="10" cy="6.5" r="0.9" fill="#FFF" />
          <circle cx="4" cy="9.5" r="0.9" fill="#FFF" />
          <circle cx="8" cy="9.5" r="0.9" fill="#FFF" />
          <circle cx="12" cy="9.5" r="0.9" fill="#FFF" />
        </svg>
      );
    case 'TR':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#E30A17" />
          <circle cx="15" cy="12" r="5.5" fill="#FFF" />
          <circle cx="16.4" cy="12" r="4.4" fill="#E30A17" />
          <polygon points="22,12 24.8,10.9 23.1,13.4 23.1,10.6 24.8,13.1" fill="#FFF" />
        </svg>
      );
    case 'AE':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="8" y="0" fill="#00732F" />
          <rect width="36" height="8" y="8" fill="#FFF" />
          <rect width="36" height="8" y="16" fill="#000" />
          <rect width="9.5" height="24" x="0" fill="#FF0000" />
        </svg>
      );
    case 'SA':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#006C35" />
          <path d="M9 10.5h18M11 13.5h14" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 17h16" stroke="#FFF" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'SY':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="8" y="0" fill="#007A3D" />
          <rect width="36" height="8" y="8" fill="#FFF" />
          <rect width="36" height="8" y="16" fill="#000" />
          <polygon points="11,9.5 11.7,11.6 13.8,11.6 12.1,12.8 12.7,14.8 11,13.6 9.3,14.8 9.9,12.8 8.2,11.6 10.3,11.6" fill="#CE1126" />
          <polygon points="18,9.5 18.7,11.6 20.8,11.6 19.1,12.8 19.7,14.8 18,13.6 16.3,14.8 16.9,12.8 15.2,11.6 17.3,11.6" fill="#CE1126" />
          <polygon points="25,9.5 25.7,11.6 27.8,11.6 26.1,12.8 26.7,14.8 25,13.6 23.3,14.8 23.9,12.8 22.2,11.6 24.3,11.6" fill="#CE1126" />
        </svg>
      );
    case 'EG':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="8" y="0" fill="#CE1126" />
          <rect width="36" height="8" y="8" fill="#FFF" />
          <rect width="36" height="8" y="16" fill="#000" />
          <rect x="16" y="9.8" width="4" height="4.4" rx="1" fill="#C09300" />
        </svg>
      );
    case 'LB':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="6" y="0" fill="#EE161F" />
          <rect width="36" height="12" y="6" fill="#FFF" />
          <rect width="36" height="6" y="18" fill="#EE161F" />
          <polygon points="18,7.5 14,15.5 22,15.5" fill="#00A651" />
        </svg>
      );
    case 'JO':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="8" y="0" fill="#000" />
          <rect width="36" height="8" y="8" fill="#FFF" />
          <rect width="36" height="8" y="16" fill="#007A3D" />
          <polygon points="0,0 16,12 0,24" fill="#CE1126" />
          <circle cx="5.5" cy="12" r="1.8" fill="#FFF" />
        </svg>
      );
    case 'PS':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="8" y="0" fill="#000" />
          <rect width="36" height="8" y="8" fill="#FFF" />
          <rect width="36" height="8" y="16" fill="#007A3D" />
          <polygon points="0,0 14,12 0,24" fill="#CE1126" />
        </svg>
      );
    case 'IQ':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="8" y="0" fill="#CE1126" />
          <rect width="36" height="8" y="8" fill="#FFF" />
          <rect width="36" height="8" y="16" fill="#000" />
          <path d="M11 12h14" stroke="#007A3D" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'YE':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="8" y="0" fill="#CE1126" />
          <rect width="36" height="8" y="8" fill="#FFF" />
          <rect width="36" height="8" y="16" fill="#000" />
        </svg>
      );
    case 'MA':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#C1272D" />
          <polygon points="18,6.5 19.6,11.3 24.6,11.3 20.5,14.2 22,19 18,16 14,19 15.5,14.2 11.4,11.3 16.4,11.3" fill="none" stroke="#006233" strokeWidth="1.5" />
        </svg>
      );
    case 'DZ':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="18" height="24" x="0" fill="#006233" />
          <rect width="18" height="24" x="18" fill="#FFF" />
          <circle cx="18" cy="12" r="5" fill="#D21034" />
          <circle cx="19.5" cy="12" r="4" fill="#FFF" />
        </svg>
      );
    case 'TN':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#E70013" />
          <circle cx="18" cy="12" r="6" fill="#FFF" />
          <circle cx="18.2" cy="12" r="3.8" fill="#E70013" />
          <circle cx="19.4" cy="12" r="3" fill="#FFF" />
        </svg>
      );
    case 'QA':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#8A1538" />
          <polygon points="0,0 10,0 13,2.5 10,5 13,7.5 10,10 13,12.5 10,15 13,17.5 10,20 13,22 10,24 0,24" fill="#FFF" />
        </svg>
      );
    case 'BH':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#CE1126" />
          <polygon points="0,0 10,0 14,3 10,6 14,9 10,12 14,15 10,18 14,21 10,24 0,24" fill="#FFF" />
        </svg>
      );
    case 'KW':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="8" y="0" fill="#007A3D" />
          <rect width="36" height="8" y="8" fill="#FFF" />
          <rect width="36" height="8" y="16" fill="#CE1126" />
          <polygon points="0,0 10,7 10,17 0,24" fill="#000" />
        </svg>
      );
    case 'OM':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="8" y="0" fill="#FFF" />
          <rect width="36" height="8" y="8" fill="#DB161B" />
          <rect width="36" height="8" y="16" fill="#008000" />
          <rect width="10" height="24" x="0" fill="#DB161B" />
          <circle cx="5" cy="5.5" r="2.2" fill="#FFF" />
        </svg>
      );
    case 'DE':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="8" y="0" fill="#000" />
          <rect width="36" height="8" y="8" fill="#DD0000" />
          <rect width="36" height="8" y="16" fill="#FFCE00" />
        </svg>
      );
    case 'FR':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="12" height="24" x="0" fill="#002395" />
          <rect width="12" height="24" x="12" fill="#FFF" />
          <rect width="12" height="24" x="24" fill="#ED2939" />
        </svg>
      );
    case 'IT':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="12" height="24" x="0" fill="#009246" />
          <rect width="12" height="24" x="12" fill="#FFF" />
          <rect width="12" height="24" x="24" fill="#CE2B37" />
        </svg>
      );
    case 'NL':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="8" y="0" fill="#AE1C28" />
          <rect width="36" height="8" y="8" fill="#FFF" />
          <rect width="36" height="8" y="16" fill="#21468B" />
        </svg>
      );
    case 'BE':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="12" height="24" x="0" fill="#000" />
          <rect width="12" height="24" x="12" fill="#FAE042" />
          <rect width="12" height="24" x="24" fill="#ED2939" />
        </svg>
      );
    case 'ES':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="6" y="0" fill="#AA151B" />
          <rect width="36" height="12" y="6" fill="#F1BF00" />
          <rect width="36" height="6" y="18" fill="#AA151B" />
          <rect x="7" y="9" width="3.5" height="5.5" rx="0.8" fill="#AA151B" />
        </svg>
      );
    case 'PT':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="14" height="24" x="0" fill="#006600" />
          <rect width="22" height="24" x="14" fill="#FF0000" />
          <circle cx="14" cy="12" r="4.5" fill="#FFCC00" />
          <rect x="12.2" y="9.8" width="3.6" height="4.4" rx="1" fill="#FFF" />
        </svg>
      );
    case 'SE':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#006AA7" />
          <rect x="11" y="0" width="4.5" height="24" fill="#FECC00" />
          <rect x="0" y="9.8" width="36" height="4.5" fill="#FECC00" />
        </svg>
      );
    case 'CH':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#D52B1E" />
          <rect x="15.5" y="5" width="5" height="14" fill="#FFF" />
          <rect x="11" y="9.5" width="14" height="5" fill="#FFF" />
        </svg>
      );
    case 'AT':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="8" y="0" fill="#ED2939" />
          <rect width="36" height="8" y="8" fill="#FFF" />
          <rect width="36" height="8" y="16" fill="#ED2939" />
        </svg>
      );
    case 'PL':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="12" y="0" fill="#FFF" />
          <rect width="36" height="12" y="12" fill="#DC143C" />
        </svg>
      );
    case 'GR':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#0D5EAF" />
          <path d="M0 4h36M0 9.5h36M0 15h36M0 20.5h36" stroke="#FFF" strokeWidth="2.6" />
          <rect width="13" height="13" fill="#0D5EAF" />
          <path d="M6.5 0v13M0 6.5h13" stroke="#FFF" strokeWidth="2.6" />
        </svg>
      );
    case 'RO':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="12" height="24" x="0" fill="#002B7F" />
          <rect width="12" height="24" x="12" fill="#FCD116" />
          <rect width="12" height="24" x="24" fill="#CE1126" />
        </svg>
      );
    case 'UA':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="12" y="0" fill="#005BBB" />
          <rect width="36" height="12" y="12" fill="#FFD500" />
        </svg>
      );
    case 'RU':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="8" y="0" fill="#FFF" />
          <rect width="36" height="8" y="8" fill="#0039A6" />
          <rect width="36" height="8" y="16" fill="#D52B1E" />
        </svg>
      );
    case 'KZ':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#00AFCA" />
          <rect x="2.5" y="2" width="2" height="20" fill="#FEC50C" />
          <circle cx="19" cy="11" r="4.5" fill="#FEC50C" />
          <path d="M13 17c2.5-1.5 9.5-1.5 12 0" stroke="#FEC50C" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'ID':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="12" y="0" fill="#CE1126" />
          <rect width="36" height="12" y="12" fill="#FFF" />
        </svg>
      );
    case 'MY':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#CC0001" />
          <path d="M0 3.4h36M0 6.8h36M0 10.2h36M0 13.6h36M0 17h36M0 20.4h36" stroke="#FFF" strokeWidth="1.7" />
          <rect width="17" height="13.5" fill="#010066" />
          <circle cx="7.2" cy="6.8" r="3.6" fill="#FFCC00" />
          <circle cx="8.4" cy="6.8" r="2.9" fill="#010066" />
          <circle cx="11.8" cy="6.8" r="1.5" fill="#FFCC00" />
        </svg>
      );
    case 'PH':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="12" y="0" fill="#0038A8" />
          <rect width="36" height="12" y="12" fill="#CE1126" />
          <polygon points="0,0 16,12 0,24" fill="#FFF" />
          <circle cx="5.8" cy="12" r="2.5" fill="#FCD116" />
        </svg>
      );
    case 'TH':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="4" y="0" fill="#A51931" />
          <rect width="36" height="4" y="4" fill="#F4F5F8" />
          <rect width="36" height="8" y="8" fill="#2D2A4A" />
          <rect width="36" height="4" y="16" fill="#F4F5F8" />
          <rect width="36" height="4" y="20" fill="#A51931" />
        </svg>
      );
    case 'VN':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#DA251D" />
          <polygon points="18,5 19.8,10.4 25.5,10.4 20.9,13.7 22.6,19.1 18,15.8 13.4,19.1 15.1,13.7 10.5,10.4 16.2,10.4" fill="#FFFF00" />
        </svg>
      );
    case 'IN':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="8" y="0" fill="#FF9933" />
          <rect width="36" height="8" y="8" fill="#FFF" />
          <rect width="36" height="8" y="16" fill="#138808" />
          <circle cx="18" cy="12" r="2.8" fill="none" stroke="#000080" strokeWidth="1.1" />
        </svg>
      );
    case 'PK':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#01411C" />
          <rect width="9" height="24" x="0" fill="#FFF" />
          <circle cx="22.5" cy="12" r="5" fill="#FFF" />
          <circle cx="24" cy="10.8" r="4.2" fill="#01411C" />
          <circle cx="24.5" cy="9.5" r="1.2" fill="#FFF" />
        </svg>
      );
    case 'JP':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#FFF" />
          <circle cx="18" cy="12" r="6" fill="#BC002D" />
        </svg>
      );
    case 'KR':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#FFF" />
          <circle cx="18" cy="12" r="5.5" fill="#CD2E3A" />
          <path d="M12.5 12a5.5 5.5 0 0 0 11 0a2.75 2.75 0 0 1-5.5 0a2.75 2.75 0 0 0-5.5 0z" fill="#0047A0" />
        </svg>
      );
    case 'CN':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#DE2910" />
          <polygon points="7,4 8.2,7.6 12,7.6 9,9.8 10.1,13.4 7,11.2 3.9,13.4 5,9.8 2,7.6 5.8,7.6" fill="#FFDE00" />
          <circle cx="14" cy="4.5" r="0.9" fill="#FFDE00" />
          <circle cx="16" cy="7" r="0.9" fill="#FFDE00" />
          <circle cx="16" cy="10.2" r="0.9" fill="#FFDE00" />
          <circle cx="14" cy="12.5" r="0.9" fill="#FFDE00" />
        </svg>
      );
    case 'SG':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="12" y="0" fill="#EF3340" />
          <rect width="36" height="12" y="12" fill="#FFF" />
          <circle cx="8" cy="6" r="3.6" fill="#FFF" />
          <circle cx="9.2" cy="6" r="3" fill="#EF3340" />
          <circle cx="12.2" cy="5.5" r="0.9" fill="#FFF" />
          <circle cx="13.8" cy="7" r="0.9" fill="#FFF" />
          <circle cx="11.2" cy="7.5" r="0.9" fill="#FFF" />
        </svg>
      );
    case 'AU':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#00008B" />
          <rect width="16" height="11" fill="#012169" />
          <path d="M0 0l16 11M16 0L0 11" stroke="#FFF" strokeWidth="1.6" />
          <path d="M8 0v11M0 5.5h16" stroke="#FFF" strokeWidth="2.8" />
          <path d="M8 0v11M0 5.5h16" stroke="#C8102E" strokeWidth="1.5" />
          <circle cx="8" cy="17.5" r="2" fill="#FFF" />
          <circle cx="27" cy="7" r="1.2" fill="#FFF" />
          <circle cx="24" cy="12" r="1.2" fill="#FFF" />
          <circle cx="30" cy="12" r="1.2" fill="#FFF" />
          <circle cx="27" cy="18" r="1.4" fill="#FFF" />
        </svg>
      );
    case 'BR':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#009B3A" />
          <polygon points="18,3 33,12 18,21 3,12" fill="#FEDF00" />
          <circle cx="18" cy="12" r="4.5" fill="#002776" />
          <path d="M13.8 11.4c2.8-.8 5.6-.4 8.4 1.2" stroke="#FFF" strokeWidth="1" fill="none" />
        </svg>
      );
    case 'CA':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="9" height="24" x="0" fill="#FF0000" />
          <rect width="18" height="24" x="9" fill="#FFF" />
          <rect width="9" height="24" x="27" fill="#FF0000" />
          <polygon points="18,6 19.6,10.2 22.8,9.2 21.4,13 23.2,14.5 19,15 19,18 17,18 17,15 12.8,14.5 14.6,13 13.2,9.2 16.4,10.2" fill="#FF0000" />
        </svg>
      );
    case 'CO':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="12" y="0" fill="#FCD116" />
          <rect width="36" height="6" y="12" fill="#003893" />
          <rect width="36" height="6" y="18" fill="#CE1126" />
        </svg>
      );
    case 'MX':
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="12" height="24" x="0" fill="#006847" />
          <rect width="12" height="24" x="12" fill="#FFF" />
          <rect width="12" height="24" x="24" fill="#CE1126" />
          <circle cx="18" cy="12" r="2.6" fill="#8B5A2B" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 36 24" className={`${className} shrink-0 overflow-hidden`}>
          <rect width="36" height="24" fill="#1E293B" />
          <circle cx="18" cy="12" r="7.5" fill="none" stroke="#38BDF8" strokeWidth="1.5" />
          <ellipse cx="18" cy="12" rx="3.5" ry="7.5" fill="none" stroke="#38BDF8" strokeWidth="1.2" />
          <path d="M10.5 12h15M12 8.5h12M12 15.5h12" stroke="#38BDF8" strokeWidth="1.1" />
        </svg>
      );
  }
};

interface ServiceIconProps {
  code: string;
  className?: string;
}

/**
 * 100% Vector Brand & Category Icons for ALL 30 services in the catalog.
 * Zero plain text fallback boxes.
 */
export const ServiceBrandIcon: React.FC<ServiceIconProps> = ({ code, className = 'w-9 h-9' }) => {
  const c = (code || '').toLowerCase();

  switch (c) {
    case 'wa': // WhatsApp
      return (
        <div className={`${className} rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.79 14.07c-.24.68-1.41 1.3-1.95 1.38-.5.08-1.14.11-1.84-.12-.43-.14-.98-.32-1.69-.63-2.97-1.28-4.91-4.28-5.06-4.48-.15-.2-1.21-1.61-1.21-3.07 0-1.46.77-2.18 1.04-2.48.27-.3.59-.37.79-.37h.57c.18 0 .43-.07.67.51.25.59.84 2.05.91 2.2.08.15.13.32.03.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.61.17.3.77 1.27 1.65 2.05 1.14 1.01 2.09 1.33 2.39 1.48.3.15.47.13.65-.08.18-.2.74-.87.94-1.16.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.5.22.57.35.07.12.07.72-.17 1.4z" />
          </svg>
        </div>
      );
    case 'tg': // Telegram
      return (
        <div className={`${className} rounded-xl bg-[#2AABEE] text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M21.9 4.6c.2-.9-.6-1.6-1.5-1.3L2.7 10.1c-.9.4-.9 1.7.1 2l4.5 1.4 1.7 5.3c.2.7 1.1.9 1.6.4l2.5-2.4 4.8 3.5c.7.5 1.7.1 1.9-.7l2.1-15zm-4.1 3.7l-7.5 6.8-.3 3.1-1.3-4.1 9.1-5.8z" />
          </svg>
        </div>
      );
    case 'go': // Google / Gmail / YouTube
      return (
        <div className={`${className} rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.7 2.87c2.16-2 3.72-4.94 3.72-8.69z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09L2.18 7.07C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.7-2.87c-.98.66-2.23 1.06-3.58 1.06-2.86 0-5.29-1.93-6.16-4.53L2.18 16.93C3.99 20.53 7.7 23 12 23z" />
          </svg>
        </div>
      );
    case 'fb': // Facebook
      return (
        <div className={`${className} rounded-xl bg-[#1877F2] text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5z" />
          </svg>
        </div>
      );
    case 'ig': // Instagram
      return (
        <div className={`${className} rounded-xl bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </div>
      );
    case 'lf': // TikTok
      return (
        <div className={`${className} rounded-xl bg-[#0F0F14] border border-cyan-400/40 text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298 0 .595.048.88.14V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z" />
          </svg>
        </div>
      );
    case 'dr': // OpenAI / ChatGPT
      return (
        <div className={`${className} rounded-xl bg-[#10A37F] text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="1.9">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3a4.5 4.5 0 0 1 4.5 4.5M21 12a4.5 4.5 0 0 1-4.5 4.5M12 21a4.5 4.5 0 0 1-4.5-4.5M3 12a4.5 4.5 0 0 1 4.5-4.5" strokeLinecap="round" />
            <path d="M7.5 4.2l9 15.6M16.5 4.2l-9 15.6M3 12h18" strokeOpacity="0.65" />
          </svg>
        </div>
      );
    case 'wx': // Apple ID / iCloud
      return (
        <div className={`${className} rounded-xl bg-slate-900 border border-white/20 text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
          </svg>
        </div>
      );
    case 'tw': // X / Twitter
      return (
        <div className={`${className} rounded-xl bg-black border border-white/25 text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </div>
      );
    case 'fu': // Snapchat
      return (
        <div className={`${className} rounded-xl bg-[#FFFC00] text-slate-950 flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white stroke-slate-950" strokeWidth="1.6">
            <path d="M12 3.5c-3.1 0-5.2 2.2-5.2 5.4v1.7c-.7-.1-1.3.2-1.4.7-.1.6.4 1 1.2 1.2-.2 1.4-1.2 2.6-2.6 3.1-.4.2-.4.7 0 .9 1 .4 2.1.6 3.1.9.3.8 1.2 1.1 2.2 1 .8-.1 1.7-.3 2.7-.3s1.9.2 2.7.3c1 .1 1.9-.2 2.2-1 1-.3 2.1-.5 3.1-.9.4-.2.4-.7 0-.9-1.4-.5-2.4-1.7-2.6-3.1.8-.2 1.3-.6 1.2-1.2-.1-.5-.7-.8-1.4-.7V8.9c0-3.2-2.1-5.4-5.2-5.4z" />
          </svg>
        </div>
      );
    case 'ds': // Discord
      return (
        <div className={`${className} rounded-xl bg-[#5865F2] text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
        </div>
      );
    case 'mm': // Microsoft / Outlook
      return (
        <div className={`${className} rounded-xl bg-slate-900 border border-white/15 flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <rect x="3" y="3" width="8.2" height="8.2" fill="#F25022" />
            <rect x="12.8" y="3" width="8.2" height="8.2" fill="#7FBA00" />
            <rect x="3" y="12.8" width="8.2" height="8.2" fill="#00A4EF" />
            <rect x="12.8" y="12.8" width="8.2" height="8.2" fill="#FFB900" />
          </svg>
        </div>
      );
    case 'ts': // PayPal
      return (
        <div className={`${className} rounded-xl bg-[#003087] text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <path fill="#009CDE" d="M8.5 19.5H6l2.2-13h5.6c2.6 0 4.2 1.2 3.8 3.6-.4 2.7-2.3 4.2-5 4.2h-2.3l-1.8 5.2z" />
            <path fill="#FFFFFF" d="M10.8 17.5H8.5l1.9-11h4.9c2.2 0 3.6 1 3.3 3.1-.4 2.2-2 3.5-4.3 3.5h-1.9l-1.6 4.4z" opacity="0.92" />
          </svg>
        </div>
      );
    case 're': // Coinbase
      return (
        <div className={`${className} rounded-xl bg-[#0052FF] text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="3.2">
            <path d="M16.5 8.5A6 6 0 1 0 16.5 15.5" strokeLinecap="round" />
          </svg>
        </div>
      );
    case 'ij': // Revolut
      return (
        <div className={`${className} rounded-xl bg-slate-950 border border-white/25 text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M7 4h6.5c2.7 0 4.5 1.5 4.5 4 0 1.9-1.1 3.3-2.9 3.8L18.5 20h-3.4l-3-7.6H10V20H7V4zm3 2.7v3.4h3.2c1.1 0 1.8-.6 1.8-1.7s-.7-1.7-1.8-1.7H10z" />
          </svg>
        </div>
      );
    case 'am': // Amazon
      return (
        <div className={`${className} rounded-xl bg-[#232F3E] text-[#FF9900] flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2.1" strokeLinecap="round">
            <path d="M4.5 14.8c4.2 3 10.2 3 14.5 0" />
            <path d="M16.8 13.8l2.5.7-.8 2.4" />
            <path d="M9.5 11.2c0-2.5 5-2.5 5 0v1.2c-1.8-.8-5-.3-5 1.1" stroke="#FFFFFF" strokeWidth="1.8" />
          </svg>
        </div>
      );
    case 'hx': // AliExpress
      return (
        <div className={`${className} rounded-xl bg-gradient-to-br from-[#FF4747] to-[#FF7A00] text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2">
            <path d="M5 8h14l-1.2 11H6.2L5 8z" />
            <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
            <path d="M9.5 13.5c1.5 1.5 3.5 1.5 5 0" strokeLinecap="round" />
          </svg>
        </div>
      );
    case 'vi': // Viber
      return (
        <div className={`${className} rounded-xl bg-[#7360F2] text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.5 5.5c-.8.8-1.2 2.2-.3 4.3.9 2.2 2.8 4.1 5 5 2.1.9 3.5.5 4.3-.3l1.2-1.2c.4-.4.4-1.1 0-1.5l-1.5-1.2c-.4-.3-1-.3-1.4.1l-.7.7c-1.1-.6-2-1.5-2.6-2.6l.7-.7c.4-.4.4-1 .1-1.4L11 5.2c-.4-.4-1.1-.4-1.5 0L7.5 5.5z" />
            <path d="M14.5 5.5a4 4 0 0 1 4 4" />
          </svg>
        </div>
      );
    case 'gr_sg': // Signal
      return (
        <div className={`${className} rounded-xl bg-[#3A76F0] text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2">
            <circle cx="12" cy="12" r="8" strokeDasharray="3.2 2.4" />
            <path d="M12 7.2a4.8 4.8 0 1 1-3.4 8.2L7 16l.6-1.6A4.8 4.8 0 0 1 12 7.2z" fill="currentColor" stroke="none" />
          </svg>
        </div>
      );
    case 'im': // Imo
      return (
        <div className={`${className} rounded-xl bg-[#00A8E8] text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2.1" strokeLinecap="round">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M8.5 11v3M8.5 8.8h.01M11.5 14v-3a1.5 1.5 0 0 1 3 0v3M16.5 12.5a1.5 1.5 0 1 0 0 .01" />
          </svg>
        </div>
      );
    case 'wb': // WeChat
      return (
        <div className={`${className} rounded-xl bg-[#07C160] text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M9.5 4.5C5.9 4.5 3 6.9 3 9.9c0 1.7.9 3.2 2.4 4.2l-.6 1.9 2.1-1c.8.2 1.7.3 2.6.3 3.6 0 6.5-2.4 6.5-5.4S13.1 4.5 9.5 4.5zm-2 4.3a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8zm4 0a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8z" />
            <path d="M15.8 10.6c-2.8 0-5.1 1.9-5.1 4.2s2.3 4.2 5.1 4.2c.6 0 1.3-.1 1.9-.3l1.7.8-.5-1.5c1.2-.8 2-2 2-3.2 0-2.3-2.3-4.2-5.1-4.2z" opacity="0.88" />
          </svg>
        </div>
      );
    case 'nf': // Netflix
      return (
        <div className={`${className} rounded-xl bg-[#141414] border border-[#E50914]/40 text-[#E50914] flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M6.5 3.5h3.2l4.8 11.4V3.5h3v17h-3.1L9.5 9.1v11.4h-3v-17z" />
          </svg>
        </div>
      );
    case 'mt': // Steam
      return (
        <div className={`${className} rounded-xl bg-gradient-to-b from-[#171A21] to-[#1B2838] border border-sky-400/35 text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2">
            <circle cx="15.5" cy="9" r="3.2" />
            <circle cx="8.5" cy="15.5" r="2.5" />
            <path d="M10.5 13.8l2.8-2.6M4 13.5l2.5 1.2" strokeLinecap="round" />
          </svg>
        </div>
      );
    case 'oi': // Tinder
      return (
        <div className={`${className} rounded-xl bg-gradient-to-tr from-[#FD297B] to-[#FF655B] text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M13.5 3.2c.5 3.3-1.4 5.5-2.8 6.4-.4-1.1-.3-2.4-.3-2.4C7.9 9.1 6.5 11.7 6.5 14.3 6.5 17.8 9 20.5 12.2 20.5s5.8-2.6 5.8-6.2c0-4.2-2.2-8.7-4.5-11.1z" />
          </svg>
        </div>
      );
    case 'ub': // Uber
      return (
        <div className={`${className} rounded-xl bg-black border border-white/25 text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2.2">
            <rect x="5" y="5" width="14" height="14" rx="3.5" />
            <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="currentColor" stroke="none" />
          </svg>
        </div>
      );
    case 'ls': // Wise
      return (
        <div className={`${className} rounded-xl bg-[#9FE870] text-[#163300] flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M6.5 5h11.8l-1.5 3h-6.6l2.3 3-3.5 3.6h8.2l-1.5 3.4H5.2l5-5.6-3.7-4.4 2-3z" />
          </svg>
        </div>
      );
    case 'tn': // LinkedIn
      return (
        <div className={`${className} rounded-xl bg-[#0A66C2] text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <circle cx="7.2" cy="7.2" r="1.7" />
            <rect x="5.8" y="10.2" width="2.8" height="8.3" rx="0.5" />
            <path d="M11 10.2h2.6v1.2c.5-.8 1.5-1.4 2.7-1.4 2.1 0 3.2 1.3 3.2 3.7v4.8h-2.8v-4.2c0-1.1-.4-1.8-1.4-1.8-1 0-1.5.7-1.5 1.8v4.2H11v-8.3z" />
          </svg>
        </div>
      );
    case 'gf': // Spotify
      return (
        <div className={`${className} rounded-xl bg-[#1DB954] text-slate-950 flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2.1" strokeLinecap="round">
            <path d="M6.5 9.2c3.5-1 7.6-.8 11 1" />
            <path d="M7.5 12.6c2.9-.8 6.2-.6 9 .9" />
            <path d="M8.5 15.8c2.2-.6 4.7-.4 6.8.7" />
          </svg>
        </div>
      );
    case 'yl': // Payoneer
      return (
        <div className={`${className} rounded-xl bg-gradient-to-tr from-[#FF4800] via-[#FF8800] to-[#00C2FF] text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2.5">
            <circle cx="12" cy="12" r="6.5" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
          </svg>
        </div>
      );
    case 'ot': // Other / Universal OTP
    default:
      return (
        <div className={`${className} rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="3" width="12" height="18" rx="2.5" />
            <path d="M10 17h4" />
            <path d="M9.5 9.5l1.6 1.6 3.4-3.4" />
          </svg>
        </div>
      );
  }
};
