import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
import { headingParts } from './markdownParts'

/**
 * Shows the small Markdown the legal texts use, as page elements (never as raw HTML, so nothing in the text can run
 * on the page): headings (#, ##, ###) with an optional anchor ("## Selling {#sellers}" → id="sellers"), paragraphs,
 * bullet lists (- item), quotes (> text), **bold**, *italic* and [links](/privacy). Links inside the site stay in
 * the site; other links open in a new tab.
 */

/** Bold, italic and links inside one line. */
function inline(text: string, key: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const k = `${key}-${i++}`
    if (m[1] !== undefined) parts.push(<strong key={k}>{inline(m[1], k)}</strong>)
    else if (m[2] !== undefined) parts.push(<em key={k}>{inline(m[2], k)}</em>)
    else {
      const href = m[4]
      const label = inline(m[3], k)
      parts.push(href.startsWith('/')
        ? <Link key={k} to={href}>{label}</Link>
        : <a key={k} href={href} target="_blank" rel="noreferrer noopener">{label}</a>)
    }
    last = pattern.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = []
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const key = `b${i}`
    if (!line.trim()) { i++; continue }

    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      const { text: words, id } = headingParts(heading[2])
      const level = heading[1].length
      const content = inline(words, key)
      blocks.push(level === 1 ? <h2 key={key} id={id}>{content}</h2>
        : level === 2 ? <h2 key={key} id={id}>{content}</h2>
        : <h3 key={key} id={id}>{content}</h3>)
      i++
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: ReactNode[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(<li key={`${key}-${items.length}`}>{inline(lines[i].replace(/^\s*[-*]\s+/, ''), `${key}-${items.length}`)}</li>)
        i++
      }
      blocks.push(<ul key={key}>{items}</ul>)
      continue
    }

    if (line.startsWith('>')) {
      const quote: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''))
      blocks.push(<blockquote key={key}>{inline(quote.join(' '), key)}</blockquote>)
      continue
    }

    const paragraph: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|\s*[-*]\s)/.test(lines[i])) paragraph.push(lines[i++].trim())
    blocks.push(<p key={key}>{inline(paragraph.join(' '), key)}</p>)
  }
  return <div className={className}>{blocks.map((b, n) => <Fragment key={n}>{b}</Fragment>)}</div>
}
