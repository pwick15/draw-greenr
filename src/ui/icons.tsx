import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  )
}

export const CursorIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4 3 7.5 17 2.4-6.9 6.9-2.4Z" />
  </Icon>
)

export const HandIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M12 10.5V4.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M15 11V6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-4.6-2.1L4 16.3s-1-1.3 0-2.2 2.2 0 2.2 0L9 17" />
  </Icon>
)

export const PlotIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 17 9 5l11 4-4 10Z" />
    <circle cx="4" cy="17" r="1.6" fill="currentColor" />
    <circle cx="9" cy="5" r="1.6" fill="currentColor" />
    <circle cx="20" cy="9" r="1.6" fill="currentColor" />
    <circle cx="16" cy="19" r="1.6" fill="currentColor" />
  </Icon>
)

export const RulerIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m3 15 6-6 12 12H3Z" transform="rotate(-45 12 12)" />
    <path d="M9 12.5 10.5 14M12 9.5 13.5 11M15 6.5 16.5 8" />
  </Icon>
)

export const UndoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8h11a5 5 0 0 1 0 10H8" />
    <path d="m7 4-4 4 4 4" />
  </Icon>
)

export const RedoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 8H10a5 5 0 0 0 0 10h6" />
    <path d="m17 4 4 4-4 4" />
  </Icon>
)

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </Icon>
)

export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Icon>
)

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Icon>
)

export const UnlockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 7.5-2" />
  </Icon>
)

export const EyeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)

export const EyeOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.3 6.5A16.7 16.7 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4-.85" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Icon>
)

export const TargetIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Icon>
)

export const GridIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </Icon>
)

export const MagnetIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 4H3v8a9 9 0 0 0 18 0V4h-3v8a6 6 0 0 1-12 0Z" />
    <path d="M3 9h3M18 9h3" />
  </Icon>
)

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const UploadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 9l5-5 5 5M12 4v12" />
  </Icon>
)

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 11l5 5 5-5M12 16V4" />
  </Icon>
)

export const LayersIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3 9 5-9 5-9-5Z" />
    <path d="m3 13 9 5 9-5M3 17l9 5 9-5" />
  </Icon>
)

export const BringForwardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="12" height="12" rx="2" />
    <path d="M9 21h10a2 2 0 0 0 2-2V9" strokeDasharray="3 3" />
  </Icon>
)

export const SendBackwardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M15 3H5a2 2 0 0 0-2 2v10" strokeDasharray="3 3" />
  </Icon>
)

export const FlipXIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v18" strokeDasharray="3 3" />
    <path d="M9 7 4 12l5 5ZM15 7l5 5-5 5Z" />
  </Icon>
)

export const FlipYIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12h18" strokeDasharray="3 3" />
    <path d="M7 9 12 4l5 5ZM7 15l5 5 5-5Z" />
  </Icon>
)

export const RotateIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v5h-5" />
  </Icon>
)

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)

export const ChevronIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
)

export const SaveIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </Icon>
)

export const ImageIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m4 17 5-5 4 4 3-3 4 4" />
  </Icon>
)
