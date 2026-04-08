import { cn } from '@/lib/utils';

interface SubterraDbLogoProps extends React.SVGProps<SVGSVGElement> {
  /** When true, hides the wordmark and renders only the icon. */
  iconOnly?: boolean;
}

// SubterraDB wordmark — recreated as inline SVG so it inherits currentColor
// for theming and stays crisp at any size. The "DB" suffix uses the brand
// gradient (orange→red), pulled from CSS variables for theme consistency.
export function SubterraDbLogo({ className, iconOnly = false, ...props }: SubterraDbLogoProps) {
  return (
    <svg
      viewBox={iconOnly ? '0 0 48 64' : '0 0 340 72'}
      className={cn('h-9 w-auto', className)}
      role="img"
      aria-label="SubterraDB"
      {...props}
    >
      <defs>
        <linearGradient id="sdb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-brand-from)" />
          <stop offset="100%" stopColor="var(--color-brand-to)" />
        </linearGradient>
        <filter id="sdb-shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="var(--color-brand-from)" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Stacked layer "strata" — represents subterranean databases */}
      <rect x="0" y="4" width="48" height="10" rx="5" fill="url(#sdb-grad)" opacity="0.4" filter="url(#sdb-shadow)" />
      <rect x="0" y="18" width="48" height="10" rx="5" fill="url(#sdb-grad)" opacity="0.6" filter="url(#sdb-shadow)" />
      <rect x="0" y="32" width="48" height="10" rx="5" fill="url(#sdb-grad)" opacity="0.8" filter="url(#sdb-shadow)" />
      <rect x="0" y="46" width="48" height="10" rx="5" fill="url(#sdb-grad)" opacity="1" filter="url(#sdb-shadow)" />
      <rect x="22.5" y="8" width="3" height="52" fill="currentColor" opacity="0.7" />

      {!iconOnly && (
        <text
          x="60"
          y="43"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="34"
          fontWeight="700"
          fill="currentColor"
          letterSpacing="-1"
        >
          subterra
          <tspan fill="url(#sdb-grad)" fontWeight="700">
            DB
          </tspan>
        </text>
      )}
    </svg>
  );
}
