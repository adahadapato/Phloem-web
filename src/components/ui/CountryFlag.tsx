import { useState } from 'react'
import type { CountryDto } from '../../api/contracts/dtos'
import styles from './CountryFlag.module.css'

/**
 * A country's flag as a picture. Windows browsers can't draw flag emojis (they show "GH"), so the flag comes from
 * flagcdn.com by the country's ISO code (from the API, so a new country needs no website change). If the picture
 * can't load, the API's emoji is shown instead.
 */
export function CountryFlag({ country, className }: { country: CountryDto; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span aria-hidden="true">{country.flag}</span>
  return (
    <img className={[styles.flag, className].filter(Boolean).join(' ')}
         src={`https://flagcdn.com/w80/${country.isoCode.toLowerCase()}.png`}
         alt="" width="30" height="20" onError={() => setFailed(true)} />
  )
}
