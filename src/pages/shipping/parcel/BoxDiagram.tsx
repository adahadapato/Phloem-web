import styles from './Parcel.module.css'

export type BoxSide = 'length' | 'width' | 'height' | null

/**
 * A simple drawing of a box with its three sides labelled, so customers know which side is which. The side being
 * typed in is highlighted. Drawn with SVG (no image file).
 */
export function BoxDiagram({ active = null, small = false }: { active?: BoxSide; small?: boolean }) {
  const tone = (side: Exclude<BoxSide, null>) => (active === side ? styles.sideActive : styles.side)
  return (
    <svg className={small ? styles.diagramSmall : styles.diagram} viewBox="0 0 240 170" role="img"
         aria-label="A box: length is the longest side along the bottom, width is the side going back, height is from the bottom to the top">
      {/* The box: front, top and right faces */}
      <path d="M40 70 L150 70 L150 140 L40 140 Z" className={styles.face} />
      <path d="M40 70 L80 40 L190 40 L150 70 Z" className={styles.faceTop} />
      <path d="M150 70 L190 40 L190 110 L150 140 Z" className={styles.faceSide} />
      {/* Tape across the top */}
      <path d="M95 70 L135 40" className={styles.tape} />

      {/* Length: along the front bottom edge */}
      <g className={tone('length')}>
        <path d="M40 154 L150 154" className={styles.arrow} markerStart="url(#box-a)" markerEnd="url(#box-a)" />
        <text x="95" y="168" textAnchor="middle">Length</text>
      </g>
      {/* Width: going back along the right bottom edge */}
      <g className={tone('width')}>
        <path d="M160 148 L200 118" className={styles.arrow} markerStart="url(#box-a)" markerEnd="url(#box-a)" />
        <text x="206" y="146" textAnchor="start">Width</text>
      </g>
      {/* Height: up the front left edge */}
      <g className={tone('height')}>
        <path d="M26 140 L26 70" className={styles.arrow} markerStart="url(#box-a)" markerEnd="url(#box-a)" />
        <text x="18" y="105" textAnchor="middle" transform="rotate(-90 18 105)">Height</text>
      </g>

      <defs>
        <marker id="box-a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="currentColor" />
        </marker>
      </defs>
    </svg>
  )
}
