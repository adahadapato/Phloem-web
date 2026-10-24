import { ButtonLink } from '../../components/ui/Button'

/** Any address the site doesn't know. */
export default function NotFoundPage() {
  return (
    <div className="container stack" style={{ paddingBlock: 64, alignItems: 'center', textAlign: 'center' }}>
      <p className="eyebrow">Page not found</p>
      <h1>We couldn't find that page.</h1>
      <p className="muted">The link may be old, or the page may have moved.</p>
      <ButtonLink to="/">Back to Home</ButtonLink>
    </div>
  )
}
