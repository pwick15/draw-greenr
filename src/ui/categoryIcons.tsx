// A lookup of glyphs, not a component module — Fast Refresh's "one component
// per file" rule does not apply, and splitting eight tiny paths across eight
// files would be worse.
/* eslint-disable react-refresh/only-export-components */
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

/** Glyphs for the asset rail, keyed by the `icon` field in the catalog. */
export const CATEGORY_ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  tree: (p) => (
    <Icon {...p}>
      <path d="M12 3 6 12h3l-4 6h14l-4-6h3Z" />
      <path d="M12 18v3" />
    </Icon>
  ),
  shrub: (p) => (
    <Icon {...p}>
      <circle cx="12" cy="11" r="6" />
      <path d="M12 17v4M9 13l3 3 3-3" />
    </Icon>
  ),
  flower: (p) => (
    <Icon {...p}>
      <circle cx="12" cy="9" r="2.2" />
      <path d="M12 6.8A2.4 2.4 0 1 0 9.8 9M12 6.8A2.4 2.4 0 1 1 14.2 9M9.8 9A2.4 2.4 0 1 0 12 11.2M14.2 9A2.4 2.4 0 1 1 12 11.2" />
      <path d="M12 12v9" />
    </Icon>
  ),
  home: (p) => (
    <Icon {...p}>
      <path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
      <path d="M9 21v-7h6v7" />
    </Icon>
  ),
  fence: (p) => (
    <Icon {...p}>
      <path d="M5 21V7l2-3 2 3v14M15 21V7l2-3 2 3v14" />
      <path d="M3 10h18M3 15h18" />
    </Icon>
  ),
  chair: (p) => (
    <Icon {...p}>
      <path d="M6 10V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5" />
      <path d="M4 10h16l-1 5H5Z" />
      <path d="M7 15v5M17 15v5" />
    </Icon>
  ),
  waves: (p) => (
    <Icon {...p}>
      <path d="M2 8c2.5-2 4.5 2 7 0s4.5-2 7 0 4.5 2 6 0M2 14c2.5-2 4.5 2 7 0s4.5-2 7 0 4.5 2 6 0M2 20c2.5-2 4.5 2 7 0s4.5-2 7 0 4.5 2 6 0" />
    </Icon>
  ),
  'circle-dot': (p) => (
    <Icon {...p}>
      <circle cx="7" cy="8" r="3" />
      <circle cx="16" cy="13" r="3.5" />
      <circle cx="9" cy="18" r="2.4" />
    </Icon>
  ),
}
