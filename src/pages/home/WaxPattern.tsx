/**
 * A faint wax-print style pattern (circles, diamonds and dots) for the dark green bands, drawn in the brand's gold and
 * mint only. Purely decorative: hidden from screen readers and from clicks.
 */
export function WaxPattern({ className }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false" width="100%" height="100%">
      <defs>
        <pattern id="phloem-wax" width="120" height="120" patternUnits="userSpaceOnUse">
          <g fill="none" strokeWidth="2">
            <circle cx="60" cy="60" r="34" stroke="var(--brand-gold)" />
            <circle cx="60" cy="60" r="22" stroke="var(--brand-mint)" />
            <circle cx="60" cy="60" r="8" fill="var(--brand-gold)" stroke="none" />
            <path d="M0 0 L20 20 L0 40 M120 0 L100 20 L120 40 M0 80 L20 100 L0 120 M120 80 L100 100 L120 120"
                  stroke="var(--brand-gold)" />
          </g>
          <circle cx="0" cy="60" r="3" fill="var(--brand-mint)" />
          <circle cx="120" cy="60" r="3" fill="var(--brand-mint)" />
          <circle cx="60" cy="0" r="3" fill="var(--brand-mint)" />
          <circle cx="60" cy="120" r="3" fill="var(--brand-mint)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#phloem-wax)" />
    </svg>
  )
}
