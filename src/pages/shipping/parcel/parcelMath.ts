/**
 * The same box maths as the API (Domain ParcelBox), so the form can say "This box counts as 12 kg" at once while the
 * server's quote is on its way. The server's quote is always the price shown.
 */

/** Same limits as the API (ParcelBox). */
export const BOX_MIN_KG = 0.1
export const BOX_MAX_KG = 500
export const SIDE_MIN_CM = 1
export const SIDE_MAX_CM = 300
export const BOX_MAX_QUANTITY = 50
export const BOX_MAX_LINES = 20

/** One box line as typed (text, so the boxes can be empty while typing). */
export interface BoxDraft {
  key: number
  weight: string
  length: string
  width: string
  height: string
  quantity: string
}

export const newBox = (key: number): BoxDraft => ({ key, weight: '', length: '', width: '', height: '', quantity: '1' })

/** "7,5" → 7.5; empty or not a number → NaN. */
export const toNumber = (text: string) => (text.trim() === '' ? Number.NaN : Number(text.replace(',', '.')))

/** Rounds UP to the next 0.5 kg. */
export const roundUpHalf = (kg: number) => Math.ceil(kg / 0.5 - 1e-9) * 0.5

export interface BoxFigures {
  /** Weight of one box, or NaN while not typed. */
  weightKg: number
  /** All three sides typed and in range. */
  hasSize: boolean
  /** Some but not all sides typed. */
  partialSize: boolean
  volumeKg: number | null
  /** What one box is charged as, or null while the weight is missing. */
  chargeableEach: number | null
  quantity: number
  /** The size, not the weight, sets the price. */
  bySize: boolean
  /** Weight, quantity and (if any) sides are within the limits. */
  valid: boolean
}

/** Works out one line, with the route's divisor (usually 5000). */
export function figures(box: BoxDraft, divisor: number): BoxFigures {
  const weightKg = toNumber(box.weight)
  const sides = [box.length, box.width, box.height].map(toNumber)
  const typed = sides.filter((s) => !Number.isNaN(s)).length
  const sidesOk = sides.every((s) => s >= SIDE_MIN_CM && s <= SIDE_MAX_CM)
  const hasSize = typed === 3 && sidesOk
  const quantity = Math.round(toNumber(box.quantity))
  const weightOk = weightKg >= BOX_MIN_KG && weightKg <= BOX_MAX_KG
  const quantityOk = quantity >= 1 && quantity <= BOX_MAX_QUANTITY

  const volumeKg = hasSize ? Math.round((sides[0] * sides[1] * sides[2] / divisor) * 100) / 100 : null
  const chargeableEach = weightOk ? roundUpHalf(Math.max(weightKg, volumeKg ?? 0)) : null

  return {
    weightKg,
    hasSize,
    partialSize: typed > 0 && typed < 3,
    volumeKg,
    chargeableEach,
    quantity: quantityOk ? quantity : 1,
    bySize: volumeKg !== null && weightOk && volumeKg > weightKg,
    valid: weightOk && quantityOk && (typed === 0 || hasSize),
  }
}

/** "12", "7.5": kg without trailing zeros. */
export const kg = (value: number) => `${Number(value.toFixed(2))} kg`
