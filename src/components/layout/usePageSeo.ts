/**
 * Puts a public page's search engine text (Smart SEO) in the browser tab and the page's head: title, description,
 * keywords, preview tags (Open Graph), the page's one true address (canonical) and, for shops, details for Google
 * (schema.org JSON-LD). Written by the AI or staff on Admin → Smart SEO; read from GET /api/seo?path=….
 *
 * Leaving the page puts the site's default title and description back. If the API has nothing for the address,
 * the defaults simply stay.
 */
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { unwrap } from '../../api/apiError'
import { getPublicSeo } from '../../api/services/seoService'

const DEFAULT_TITLE = typeof document !== 'undefined' ? document.title : 'Phloem'
const DEFAULT_DESCRIPTION = typeof document !== 'undefined'
  ? document.querySelector('meta[name="description"]')?.getAttribute('content') ?? ''
  : ''

/** Sets (or adds) a <meta> tag; returns a function that removes what it added. */
function setMeta(attribute: 'name' | 'property', key: string, content: string | null | undefined): () => void {
  if (!content) return () => {}
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  const added = !tag
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
  return () => { if (added) tag?.remove() }
}

/** Adds a tag to the head; returns a function that removes it. */
function addTag(make: () => HTMLElement): () => void {
  const tag = make()
  document.head.appendChild(tag)
  return () => tag.remove()
}

/**
 * Uses the search engine text for this page.
 * @param path The page's website address, e.g. "/explore" or "/shops/{id}".
 */
export function usePageSeo(path: string): void {
  const seo = useQuery({
    queryKey: ['seo', path],
    queryFn: async ({ signal }) => unwrap(await getPublicSeo(path, signal)),
    staleTime: 10 * 60_000,
    retry: false,
  })
  const s = seo.data

  useEffect(() => {
    if (!s) return
    document.title = s.title
    const description = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')
    description?.setAttribute('content', s.description)

    const undo = [
      setMeta('name', 'keywords', s.keywords),
      setMeta('property', 'og:title', s.title),
      setMeta('property', 'og:description', s.description),
      setMeta('property', 'og:url', s.canonicalUrl),
      setMeta('property', 'og:image', s.imageUrl),
      addTag(() => Object.assign(document.createElement('link'), { rel: 'canonical', href: s.canonicalUrl })),
      s.jsonLd
        ? addTag(() => Object.assign(document.createElement('script'), { type: 'application/ld+json', text: s.jsonLd! }))
        : () => {},
    ]

    return () => {
      undo.forEach((u) => u())
      document.title = DEFAULT_TITLE
      description?.setAttribute('content', DEFAULT_DESCRIPTION)
    }
  }, [s])
}
