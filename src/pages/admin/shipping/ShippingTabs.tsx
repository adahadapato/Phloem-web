import { NavLink } from 'react-router'
import styles from '../Admin.module.css'

/** The Shipping area's three pages, under its title. */
export function ShippingTabs() {
  const tab = ({ isActive }: { isActive: boolean }) => (isActive ? `${styles.subTab} ${styles.subTabOn}` : styles.subTab)
  return (
    <nav className={styles.subTabs} aria-label="Shipping">
      <NavLink to="/admin/shipping" end className={tab}>Routes & prices</NavLink>
      <NavLink to="/admin/shipping/parcels" className={tab}>Parcels</NavLink>
      <NavLink to="/admin/shipping/rules" className={tab}>What can be sent</NavLink>
    </nav>
  )
}
