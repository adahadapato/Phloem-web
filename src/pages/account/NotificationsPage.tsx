import { useState } from 'react'
import { Link } from 'react-router'
import type { UpdateNotificationsCommand } from '../../api/contracts/commands'
import { updateNotifications } from '../../api/services/accountService'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { useSession } from '../../state/SessionContext'
import styles from './Account.module.css'

type Key = keyof UpdateNotificationsCommand

/** One switch row: title, small line, the switch. */
function Switch({ title, sub, checked, onChange, disabled }: {
  title: string; sub: string; checked: boolean; onChange: (on: boolean) => void; disabled: boolean
}) {
  return (
    <label className={styles.switchRow}>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        <span className="muted">{sub}</span>
      </span>
      <input type="checkbox" role="switch" className={styles.switch} checked={checked} disabled={disabled}
             onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

/**
 * Notifications, like the app's: ORDERS (Order updates, UK shipments), MY SHOP (New shop orders, only for people with
 * a shop), NEWS AND OFFERS (Offers and discounts, New dishes near me). Changes save straight away.
 */
export default function NotificationsPage() {
  const { profile, refreshProfile } = useSession()
  const [values, setValues] = useState<UpdateNotificationsCommand>({
    orderUpdates: profile?.notifyOrderUpdates ?? true,
    shipmentUpdates: profile?.notifyShipmentUpdates ?? true,
    offers: profile?.notifyOffers ?? false,
    newDishes: profile?.notifyNewDishes ?? false,
    shopOrders: profile?.notifyShopOrders ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  if (!profile) return null

  /** Flips one switch and saves; puts it back if the API refuses. */
  const toggle = async (key: Key, on: boolean) => {
    const before = values
    const next = { ...values, [key]: on }
    setValues(next)
    setSaving(true)
    const result = await updateNotifications(next)
    setSaving(false)
    if (result.ok) {
      setMessage({ text: 'Saved.', isError: false })
      void refreshProfile()
    } else {
      setValues(before)
      setMessage({ text: result.error.displayMessage, isError: true })
    }
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.inner}>
        <Link to="/account" className={styles.back}>‹ My account</Link>
        <div className={styles.heading}>
          <h1>Notifications</h1>
          <p className="muted">Choose what Phloem tells you about</p>
        </div>

        <section className={styles.card}>
          <p className={styles.groupTitle}>ORDERS</p>
          <div>
            <Switch title="Order updates" sub="Confirmed, on the way, delivered" checked={values.orderUpdates}
                    disabled={saving} onChange={(on) => toggle('orderUpdates', on)} />
            <Switch title="UK shipments" sub="Tracking for food you send to the UK" checked={values.shipmentUpdates}
                    disabled={saving} onChange={(on) => toggle('shipmentUpdates', on)} />
          </div>

          {profile.hasShop && (
            <>
              <p className={styles.groupTitle}>MY SHOP</p>
              <Switch title="New shop orders" sub="When a customer orders from your shop" checked={values.shopOrders}
                      disabled={saving} onChange={(on) => toggle('shopOrders', on)} />
            </>
          )}

          <p className={styles.groupTitle}>NEWS AND OFFERS</p>
          <div>
            <Switch title="Offers and discounts" sub="Deals from Phloem and your favourite shops" checked={values.offers}
                    disabled={saving} onChange={(on) => toggle('offers', on)} />
            <Switch title="New dishes near me" sub="When new food is added in your country" checked={values.newDishes}
                    disabled={saving} onChange={(on) => toggle('newDishes', on)} />
          </div>
        </section>

        <p className="muted" style={{ marginBottom: 12 }}>Changes save automatically.</p>
        <StatusBanner message={message?.text} isError={message?.isError} />
      </div>
    </div>
  )
}
