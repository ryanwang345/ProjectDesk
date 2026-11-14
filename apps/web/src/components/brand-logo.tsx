interface BrandLogoProps {
  className?: string
}

export function BrandLogo({ className = 'size-9' }: BrandLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="linguadesk-bg" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#357a65" />
          <stop offset="55%" stopColor="#265949" />
          <stop offset="100%" stopColor="#193e33" />
        </linearGradient>
        <linearGradient id="linguadesk-spark" x1="27" y1="6" x2="33" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* Rounded badge */}
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#linguadesk-bg)" />
      <rect x="1.5" y="1.5" width="37" height="37" rx="10.5" stroke="#ffffff" strokeOpacity="0.16" />

      {/* Left & right open-book pages forming a refined LinguaDesk desk/book silhouette */}
      <path
        d="M9.5 13.5C9.5 12.12 10.62 11 12 11H18.5C19.33 11 20 11.67 20 12.5V28.5C19.2 27.6 17.9 27 16.4 27H11.5C10.4 27 9.5 26.1 9.5 25V13.5Z"
        fill="#f6f3ea"
        fillOpacity="0.96"
      />
      <path
        d="M30.5 15.5V25C30.5 26.1 29.6 27 28.5 27H23.6C22.1 27 20.8 27.6 20 28.5V12.5C20 11.67 20.67 11 21.5 11H24.2"
        stroke="#f6f3ea"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Subtle text lines on left page */}
      <path
        d="M12.5 16H17M12.5 19.5H17M12.5 23H15.5"
        stroke="#265949"
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      {/* Accent bookmark / sound-bar strokes on right page */}
      <path
        d="M23.5 18.5V23M26.8 16.8V23"
        stroke="#a7f3d0"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Four-point AI spark */}
      <path
        d="M30 6.5L31.05 9.45L34 10.5L31.05 11.55L30 14.5L28.95 11.55L26 10.5L28.95 9.45L30 6.5Z"
        fill="url(#linguadesk-spark)"
      />
    </svg>
  )
}
