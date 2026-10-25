/** Small helpers for the Markdown the legal texts use (shared by the Markdown component and the legal page). */

/** A heading's text and its anchor (from "{#anchor}", or made from the words). */
export function headingParts(raw: string): { text: string; id: string } {
  const match = raw.match(/^(.*?)\s*\{#([\w-]+)\}\s*$/)
  const text = (match ? match[1] : raw).trim()
  const id = match ? match[2] : text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
  return { text, id }
}

/** The text's "## " headings (sections), for an "On this page" list. */
export function sections(text: string): { text: string; id: string }[] {
  return text.split(/\r?\n/).filter((l) => /^##\s+/.test(l)).map((l) => headingParts(l.replace(/^##\s+/, '')))
}
