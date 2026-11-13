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

/* 공통 아이콘 */
export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="4.5" width="18" height="16.5" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></Svg>
);
export const UsersIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="8" r="3" /><circle cx="5" cy="10" r="2.2" /><circle cx="19" cy="10" r="2.2" /><path d="M6.5 19a5.5 5.5 0 0 1 11 0M1.5 18.5a3.8 3.8 0 0 1 4.5-3.6M22.5 18.5a3.8 3.8 0 0 0-4.5-3.6" /></Svg>
);
export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Svg>
);
export const LogOutIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Svg>
);
export const ClockIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>
);
export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
);
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const AlertCircleIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></Svg>
);
export const CheckCircleIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></Svg>
);
export const XCircleIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></Svg>
);
export const LockIcon = (p: IconProps) => (
  <Svg {...p}><rect x="4" y="10.5" width="16" height="10.5" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5M12 15v2" /></Svg>
);
export const HelpIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2a2.6 2.6 0 0 1 5 1c0 1.8-2.5 2.3-2.5 3.8M12 17h.01" /></Svg>
);
export const FileIcon = (p: IconProps) => (
  <Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></Svg>
);
export const PlayCircleIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m10 8.5 5 3.5-5 3.5v-7Z" /></Svg>
);
export const LinkIcon = (p: IconProps) => (
  <Svg {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></Svg>
);
export const PencilIcon = (p: IconProps) => (
  <Svg {...p}><path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" /></Svg>
);
export const SendIcon = (p: IconProps) => (
  <Svg {...p}><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></Svg>
);
export const MegaphoneIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1ZM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></Svg>
);
export const StarIcon = (p: IconProps) => (
  <Svg {...p}><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z" /></Svg>
);
export const SparklesIcon = (p: IconProps) => (
  <Svg {...p}><path d="m11 4 1.8 5.2L18 11l-5.2 1.8L11 18l-1.8-5.2L4 11l5.2-1.8z" /><path d="M19 3v4M21 5h-4M18 17v4M20 19h-4" /></Svg>
);
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></Svg>
);
export const XIcon = (p: IconProps) => (
  <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>
);
export const LightbulbIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" /></Svg>
);
export const TableIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /></Svg>
);
export const SlidersIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></Svg>
);
export const AlertTriangleIcon = (p: IconProps) => (
  <Svg {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" /></Svg>
);
export const UserPlusIcon = (p: IconProps) => (
  <Svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></Svg>
);
export const KeyIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14.5 8.5l2 2" /></Svg>
);
export const SearchIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
);
export const CopyIcon = (p: IconProps) => (
  <Svg {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></Svg>
);
export const UserCheckIcon = (p: IconProps) => (
  <Svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m16 11 2 2 4-4" /></Svg>
);
export const CalendarPlusIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 13v5M9.5 15.5h5" /></Svg>
);
