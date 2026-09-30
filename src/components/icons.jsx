// Inline stroke icons (no icon-font download, works offline).
const I = ({ d, className = 'h-6 w-6', children, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...p}>
    {d ? <path d={d} /> : children}
  </svg>
);

export const IconScan = (p) => (
  <I {...p}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <circle cx="11.5" cy="11.5" r="3.5" />
    <path d="m14 14 2.5 2.5" />
  </I>
);
export const IconCards = (p) => (
  <I {...p}>
    <rect x="7" y="3" width="12" height="16" rx="2" />
    <path d="M4.5 6.5v11A2.5 2.5 0 0 0 7 20h9" />
  </I>
);
export const IconRocket = (p) => (
  <I {...p}>
    <path d="M5 15c-1.5 1-2 4-2 4s3-.5 4-2" />
    <path d="M9 12a13 13 0 0 1 11-9 13 13 0 0 1-9 11l-2-2Z" />
    <path d="M9 12H5l2-4h4M12 15v4l4-2v-4" />
  </I>
);
export const IconGear = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </I>
);
export const IconCamera = (p) => (
  <I {...p}>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </I>
);
export const IconUpload = (p) => <I {...p} d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />;
export const IconEdit = (p) => <I {...p} d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4" />;
export const IconRefresh = (p) => <I {...p} d="M20 11a8 8 0 0 0-14.8-4M4 5v4h4M4 13a8 8 0 0 0 14.8 4M20 19v-4h-4" />;
export const IconExternal = (p) => <I {...p} d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />;
export const IconCopy = (p) => (
  <I {...p}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
  </I>
);
export const IconShare = (p) => <I {...p} d="M12 3v12m0-12L8 7m4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />;
export const IconTrash = (p) => <I {...p} d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />;
export const IconSearch = (p) => (
  <I {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </I>
);
export const IconPlus = (p) => <I {...p} d="M12 5v14M5 12h14" />;
export const IconCheck = (p) => <I {...p} d="m5 12 5 5 9-10" />;
export const IconSparkle = (p) => <I {...p} d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />;
export const IconDownload = (p) => <I {...p} d="M12 4v12m0 0-5-5m5 5 5-5M4 20h16" />;
export const IconWifiOff = (p) => <I {...p} d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M19 13a10 10 0 0 0-2.4-1.7M2 9a15 15 0 0 1 4.6-2.8M22 9a15 15 0 0 0-11-4" />;
