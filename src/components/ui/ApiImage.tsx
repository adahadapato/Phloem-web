import { useState, type ImgHTMLAttributes } from 'react'
import { fileUrl } from '../../api/config'

type ApiImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  /** The link the API returned (dish photo, shop logo, profile photo); null/empty = no picture. */
  src: string | null | undefined
  /** Text for screen readers. Describe the food or the shop, e.g. "Jollof rice from Ama's Kitchen". */
  alt: string
}

/**
 * A picture that comes from the API: food photos, shop logos and profile photos are NEVER shipped with the website.
 * Shows a neutral placeholder when there is no picture or it can't be loaded, instead of a broken image.
 * Loads lazily (only when scrolled near).
 */
export function ApiImage({ src, alt, className, ...rest }: ApiImageProps) {
  const url = fileUrl(src)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  if (!url || failedUrl === url) {
    return (
      <div role="img" aria-label={alt} className={className}
           style={{
             display: 'grid', placeItems: 'center', background: 'var(--brand-mint-pale)',
             color: 'var(--brand-green)', aspectRatio: '4 / 3',
           }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
             aria-hidden="true">
          <path d="M3 13h18a9 9 0 0 1-18 0Z" />
          <path d="M8 9c0-1.5 1-2 1-3.5M12 9c0-1.5 1-2 1-3.5M16 9c0-1.5 1-2 1-3.5" />
        </svg>
      </div>
    )
  }

  return <img src={url} alt={alt} loading="lazy" decoding="async" className={className}
              onError={() => setFailedUrl(url)} {...rest} />
}
