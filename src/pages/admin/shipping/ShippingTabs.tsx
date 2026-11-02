import { NavLink } from 'react-router'
import { Permissions } from '../../../api/contracts/permissions'
import { useSession } from '../../../state/SessionContext'
import styles from '../Admin.module.css'

/**
 * The Shipping area's pages, under its title. Routes & prices and What can be sent need `parcels.settings`; Parcels
 * needs `parcels.manage`. Only the tabs the person can open are shown (owners see all three).
 */
export function ShippingTabs() {
  const { hasPermission } = useSession()
  const settings = hasPermission(Permissions.ParcelsSettings)
  const parcels = hasPermission(Permissions.ParcelsManage)
  const tab = ({ isActive }: { isActive: boolean }) => (isActive ? `${styles.subTab} ${styles.subTabOn}` : styles.subTab)
  return (
    <nav className={styles.subTabs} aria-label="Shipping">
      {settings && <NavLink to="/admin/shipping" end className={tab}>Routes & prices</NavLink>}
      {parcels && <NavLink to="/admin/shipping/parcels" className={tab}>Parcels</NavLink>}
      {settings && <NavLink to="/admin/shipping/rules" className={tab}>What can be sent</NavLink>}
    </nav>
  )
}
