/** 선 아이콘 (24×24, currentColor). 외부 라이브러리 없이 쓰는 최소 세트 */
type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ArrowLeftIcon = (p: IconProps) => (
  <Svg {...p}><path d="M19 12H5M12 19l-7-7 7-7" /></Svg>
);
export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}><path d="M5 12h14M12 5l7 7-7 7" /></Svg>
);
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>
);
export const ChurchIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 2v4M10 4h4M6 21v-8l6-4 6 4v8M4 21h16M10 21v-4a2 2 0 0 1 4 0v4" /></Svg>
);
export const UserIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>
);
export const InfoIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></Svg>
);
export const ListMusicIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3 6h12M3 12h9M3 18h7M17 18V8l4-1" /><circle cx="15" cy="18" r="2" /></Svg>
);
export const IdCardIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M9 3v4M15 3v4" /><circle cx="9" cy="12.5" r="2" /><path d="M6.5 17a3 3 0 0 1 5 0M14 12h4M14 15h3" /></Svg>
);
export const MapPinIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></Svg>
);
export const ShieldAlertIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="M12 8v4M12 15.5h.01" /></Svg>
);
export const ShieldCheckIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></Svg>
);

/* 세션 아이콘 */
export const MicStandIcon = (p: IconProps) => (
  <Svg {...p}><rect x="9" y="2" width="6" height="10" rx="3" /><path d="M12 12v9M8 21h8" /></Svg>
);
export const MicIcon = (p: IconProps) => (
  <Svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Svg>
);
export const PianoIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M8 5v8M12 5v8M16 5v8M8 13v6M12 13v6M16 13v6" /></Svg>
);
export const NoteIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></Svg>
);
export const WaveIcon = (p: IconProps) => (
  <Svg {...p}><path d="M2 12h2M6 8v8M10 5v14M14 9v6M18 7v10M22 12h-2" /></Svg>
);
export const ZapIcon = (p: IconProps) => (
  <Svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></Svg>
);
export const GuitarIcon = (p: IconProps) => (
  <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="12" cy="13" r="3" /><path d="M12 4v6" /></Svg>
);
export const DrumIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></Svg>
);
export const BarsIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6 20v-6M12 20V4M18 20v-9" /></Svg>
);
export const CaptionIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 11h3M13 11h4M7 15h6M15 15h2" /></Svg>
);
