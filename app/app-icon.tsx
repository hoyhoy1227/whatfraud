type AppIconProps = {
  name: string;
  size?: 'app' | 'mini';
  className?: string;
};

function IconArtwork({ name }: { name: string }) {
  switch (name) {
    case 'messages':
      return <><path d="M5.2 5.5h13.6a2.2 2.2 0 0 1 2.2 2.2v7.1a2.2 2.2 0 0 1-2.2 2.2H11l-4.3 3v-3H5.2A2.2 2.2 0 0 1 3 14.8V7.7a2.2 2.2 0 0 1 2.2-2.2Z"/><circle cx="8" cy="11.3" r=".8" fill="currentColor" stroke="none"/><circle cx="12" cy="11.3" r=".8" fill="currentColor" stroke="none"/><circle cx="16" cy="11.3" r=".8" fill="currentColor" stroke="none"/></>;
    case 'calls':
      return <path d="M7.4 3.7 10 7.6 8.5 9.4c1.1 2.4 2.7 4 5.1 5.1l1.8-1.5 3.9 2.6-.7 3.5c-.2 1-1.1 1.7-2.1 1.6C9.3 19.8 4.2 14.7 3.3 7.5c-.1-1 .6-1.9 1.6-2.1l2.5-.7Z"/>;
    case 'bank':
      return <><path d="m3.5 9 8.5-5 8.5 5"/><path d="M5 10.2h14M6.2 10.2v7.1m3.8-7.1v7.1m4-7.1v7.1m3.8-7.1v7.1M4.2 19.6h15.6"/></>;
    case 'stocks':
      return <><path d="M4 18.5V14m4 4.5V9.7m4 8.8v-6.2m4 6.2V7m4 11.5V4.8"/><path d="m4.2 11.3 4-3.1 3.8 1.9 7.7-6"/></>;
    case 'browser':
      return <><circle cx="12" cy="12" r="8.7"/><path d="m14.8 9.2-1.5 4.1-4.1 1.5 1.5-4.1 4.1-1.5Z"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></>;
    case 'social':
      return <><circle cx="9" cy="9" r="3"/><circle cx="16.7" cy="10" r="2.3"/><path d="M3.8 19c.4-3.3 2.2-5 5.2-5s4.8 1.7 5.2 5M14.1 14.7c.8-.5 1.7-.7 2.7-.7 2.4 0 3.8 1.3 4.1 4"/></>;
    case 'calendar':
      return <><path d="M5 5.5h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"/><path d="M7.5 3.5v4M16.5 3.5v4M3 9h18"/><path d="M8.4 13.1h2.2l-2.2 4h2.4m2.2-4h2.7l-2.5 4h2.8"/></>;
    case 'notes':
      return <><path d="M5 3.5h10.5L20 8v12.5H5Z"/><path d="M15.5 3.5V8H20M8 11h8M8 14h8M8 17h5"/></>;
    case 'contacts':
      return <><rect x="3.5" y="4" width="17" height="16" rx="3"/><circle cx="10" cy="10" r="2.5"/><path d="M5.8 17c.5-2.4 1.9-3.6 4.2-3.6s3.7 1.2 4.2 3.6M16.5 9h2M16.5 12h2"/></>;
    case 'safety':
      return <><path d="M12 3.2c2.4 1.7 5 2.5 7.4 2.7v5.3c0 4.7-2.4 7.7-7.4 9.7-5-2-7.4-5-7.4-9.7V5.9C7 5.7 9.6 4.9 12 3.2Z"/><path d="m8.6 12 2.1 2.1 4.8-5"/></>;
    case 'settings':
      return <><circle cx="12" cy="12" r="3.2"/><path d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1M5.8 5.8l1.5 1.5m9.4 9.4 1.5 1.5m0-12.4-1.5 1.5m-9.4 9.4-1.5 1.5"/><circle cx="12" cy="12" r="7"/></>;
    case 'photos':
      return <><rect x="3.5" y="4" width="17" height="16" rx="3"/><circle cx="15.8" cy="8.3" r="1.7"/><path d="m5.5 17 4.2-4.5 3.1 3 2-2 3.7 3.5"/></>;
    default:
      return <circle cx="12" cy="12" r="7"/>;
  }
}

export default function AppIcon({ name, size = 'app', className = '' }: AppIconProps) {
  return (
    <i className={`${size === 'mini' ? 'mini-icon' : 'app-icon'} icon-${name} ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        <IconArtwork name={name} />
      </svg>
    </i>
  );
}
