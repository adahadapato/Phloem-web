import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Field } from '../../../components/ui/Field'
import { BoxDiagram, type BoxSide } from './BoxDiagram'
import {
  BOX_MAX_KG, BOX_MAX_LINES, BOX_MAX_QUANTITY, BOX_MIN_KG, SIDE_MAX_CM, SIDE_MIN_CM, figures, kg, newBox,
  type BoxDraft,
} from './parcelMath'
import styles from './Parcel.module.css'

/** "Why do you need the size?": the explanation customers asked for, with the labelled drawing. */
export function BoxSizeExplainer({ divisor, active }: { divisor: number; active: BoxSide }) {
  return (
    <div className={styles.explainer}>
      <BoxDiagram active={active} />
      <div>
        <p className={styles.explainerTitle}>Why we ask for the size</p>
        <p>
          Planes charge for the <strong>space</strong> a parcel takes as well as its weight. So for each box we work out
          a <strong>size weight</strong>: length × width × height in cm, divided by {divisor.toLocaleString('en-GB')}.
          You pay for whichever is higher, the real weight or the size weight, rounded up to the next 0.5 kg.
        </p>
        <ul className={styles.explainerList}>
          <li><strong>Measure the outside</strong> of the box, with a tape measure, after packing and taping it.</li>
          <li><strong>Length</strong> is the longest side, <strong>width</strong> the side next to it, <strong>height</strong> from the bottom to the top.</li>
          <li>Round up to the next whole cm. A 60 × 40 × 40 cm box counts as at least {kg(Math.ceil((60 * 40 * 40 / divisor) * 2) / 2)}.</li>
          <li>Not sure yet? Leave the size empty: we measure every box at the hub and the final price uses our measurements.</li>
        </ul>
      </div>
    </div>
  )
}

/**
 * The parcel's boxes: one line per kind of box (weight of ONE box, outside size, how many). Each line says at once
 * what it counts as ("This box counts as 12 kg: its size counts for more than its weight"). Identical boxes: one line
 * with a quantity.
 */
export function BoxList({ boxes, onChange, divisor, fieldError }: {
  boxes: BoxDraft[]
  onChange: (boxes: BoxDraft[]) => void
  /** The route's divisor (usually 5000). */
  divisor: number
  /** The API's message for a field, e.g. "Boxes[0].WeightKg". */
  fieldError: (name: string) => string | undefined
}) {
  const [active, setActive] = useState<BoxSide>(null)
  const set = (key: number, change: Partial<BoxDraft>) =>
    onChange(boxes.map((b) => (b.key === key ? { ...b, ...change } : b)))
  const side = (name: Exclude<BoxSide, null>) => ({
    onFocus: () => setActive(name),
    onBlur: () => setActive(null),
  })

  return (
    <>
      <BoxSizeExplainer divisor={divisor} active={active} />

      {boxes.map((box, index) => {
        const f = figures(box, divisor)
        const err = (field: string) => fieldError(`Boxes[${index}].${field}`)
        return (
          <fieldset key={box.key} className={styles.box}>
            <legend className={styles.boxTitle}>
              {boxes.length > 1 ? `Box ${index + 1}` : 'Your box'}
            </legend>
            <p className={styles.sizeNote}>Size is optional when booking: leave it empty if you're not sure.</p>
            <div className={styles.boxGrid}>
              <Field label="Weight of one box (kg)" type="number" inputMode="decimal" min={BOX_MIN_KG} max={BOX_MAX_KG}
                     step="0.1" value={box.weight} placeholder="e.g. 8.5"
                     onChange={(e) => set(box.key, { weight: e.target.value })} error={err('WeightKg')} />
              <Field label="Length (cm)" type="number" inputMode="decimal" min={SIDE_MIN_CM} max={SIDE_MAX_CM}
                     value={box.length} placeholder="L" {...side('length')}
                     onChange={(e) => set(box.key, { length: e.target.value })} error={err('LengthCm')} />
              <Field label="Width (cm)" type="number" inputMode="decimal" min={SIDE_MIN_CM} max={SIDE_MAX_CM}
                     value={box.width} placeholder="W" {...side('width')}
                     onChange={(e) => set(box.key, { width: e.target.value })} error={err('WidthCm')} />
              <Field label="Height (cm)" type="number" inputMode="decimal" min={SIDE_MIN_CM} max={SIDE_MAX_CM}
                     value={box.height} placeholder="H" {...side('height')}
                     onChange={(e) => set(box.key, { height: e.target.value })} error={err('HeightCm')} />
              <Field label="How many" type="number" inputMode="numeric" min={1} max={BOX_MAX_QUANTITY}
                     value={box.quantity} hint="Same size and weight"
                     onChange={(e) => set(box.key, { quantity: e.target.value })} error={err('Quantity')} />
            </div>

            <p className={f.bySize ? styles.countsBySize : styles.counts} aria-live="polite">
              {f.partialSize ? 'Please give all three sides (length, width and height), or leave them all empty.'
                : f.chargeableEach === null ? 'Enter the weight of one box.'
                : f.bySize
                  ? <>This box counts as <strong>{kg(f.chargeableEach)}</strong>: it weighs {kg(f.weightKg)}, but its size counts as {kg(f.volumeKg!)}. A smaller box would cost less.</>
                  : <>This box counts as <strong>{kg(f.chargeableEach)}</strong>{f.hasSize ? ` (its size counts as ${kg(f.volumeKg!)}, less than its weight)` : ' (rounded up to the next 0.5 kg)'}.</>}
              {f.chargeableEach !== null && !f.partialSize && f.quantity > 1 && <> × {f.quantity} boxes = <strong>{kg(f.chargeableEach * f.quantity)}</strong>.</>}
            </p>

            {boxes.length > 1 && (
              <button type="button" className={styles.remove} onClick={() => onChange(boxes.filter((b) => b.key !== box.key))}>
                Remove this box
              </button>
            )}
          </fieldset>
        )
      })}

      {boxes.length < BOX_MAX_LINES && (
        <div>
          <Button small variant="secondary"
                  onClick={() => onChange([...boxes, newBox(Math.max(0, ...boxes.map((b) => b.key)) + 1)])}>
            + Add a different box
          </Button>
        </div>
      )}
    </>
  )
}
