import { Link } from 'react-router'

/**
 * A small "Need help?" line where people often get stuck (Checkout, orders, parcels), opening the Help page at the
 * right section (the Help text's anchors: orders, parcels, selling, account, contact).
 */
export function NeedHelp({ text = 'Need help?', section, className }: { text?: string; section?: string; className?: string }) {
  return (
    <p className={['muted', className].filter(Boolean).join(' ')} style={{ fontSize: 13, margin: '8px 0 0' }}>
      <span aria-hidden="true">💬</span> {text}{' '}
      <Link to={section ? `/help#${section}` : '/help'} style={{ fontWeight: 700 }}>Help &amp; support ›</Link>
    </p>
  )
}
