import { useMatches } from 'react-router'
import { ButtonLink } from '../../components/ui/Button'

/**
 * TEMPORARY: stands in for pages not built yet, so every link already goes somewhere. The title comes from the
 * route's `handle.title` (see routes.tsx). Each route switches to its real page as it's built; delete this file when
 * none use it.
 */
export default function ComingSoonPage() {
  const matches = useMatches()
  const handle = matches[matches.length - 1]?.handle as { title?: string } | undefined

  return (
    <div className="container stack" style={{ paddingBlock: 64, alignItems: 'center', textAlign: 'center' }}>
      <p className="eyebrow">Coming soon</p>
      <h1>{handle?.title ?? 'This page'}</h1>
      <p className="muted">This page is on its way. Meanwhile, everything is available in the Phloem app.</p>
      <ButtonLink to="/" variant="secondary">Back to Home</ButtonLink>
    </div>
  )
}
