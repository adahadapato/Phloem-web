/**
 * Typo-tolerant matching for place names, the same rules as the API's TownMatching: "port harcort" finds
 * "Port Harcourt", "ikja" finds "Ikeja".
 */

/** "  Lekki-Phase 1. " → "lekki phase 1" (lower case, letters and digits, single spaces, no accents). */
export function normalise(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** Edit distance where swapping two neighbouring letters ("lagso" → "lagos") counts as one mistake. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return Infinity
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)]
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let rowBest = i
    for (let j = 1; j <= b.length; j++) {
      let d = Math.min(row[j - 1] + 1, rows[i - 1][j] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, rows[i - 2][j - 2] + 1)
      row[j] = d
      rowBest = Math.min(rowBest, d)
    }
    if (rowBest > max) return Infinity
    rows.push(row)
  }
  return rows[a.length][b.length]
}

/** 0 exact, 1 starts with, 2 a word starts with, 3 contains, 10+n typing mistakes away; null = no match. */
export function matchScore(candidate: string, typed: string): number | null {
  const c = normalise(candidate)
  const t = normalise(typed)
  if (!t) return 0
  if (c === t) return 0
  if (c.startsWith(t)) return 1
  if (c.includes(` ${t}`)) return 2
  if (c.includes(t)) return 3
  const allowed = t.length < 4 ? 0 : t.length < 7 ? 1 : 2
  if (!allowed) return null
  const best = Math.min(distance(c, t, allowed), c.length > t.length ? distance(c.slice(0, t.length), t, allowed) : Infinity)
  return best <= allowed ? 10 + best : null
}
