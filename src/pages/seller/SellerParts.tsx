import { Link, NavLink } from 'react-router'
import type { MyShopDto } from '../../api/contracts/dtos'
import { ApiImage } from '../../components/ui/ApiImage'
import { documentText } from '../../components/ui/labels'
import styles from './Seller.module.css'

/** The seller area's tabs, under the shop's name on every seller page. */
export function SellerTabs({ newOrders }: { newOrders?: number }) {
  const tab = ({ isActive }: { isActive: boolean }) => (isActive ? `${styles.tab} ${styles.tabOn}` : styles.tab)
  return (
    <nav className={styles.tabs} aria-label="Seller area">
      <NavLink to="/seller" end className={tab}>Dashboard</NavLink>
      <NavLink to="/seller/orders" className={tab}>
        Orders {!!newOrders && <span className={styles.count} aria-label={`${newOrders} new`}>{newOrders}</span>}
      </NavLink>
      <NavLink to="/seller/dishes" className={tab}>My dishes</NavLink>
      <NavLink to="/seller/settings" className={tab}>Shop settings</NavLink>
    </nav>
  )
}

/** The top of every seller page: logo, shop name, status, then the tabs. */
export function SellerHeader({ shop, newOrders }: { shop: MyShopDto | undefined; newOrders?: number }) {
  return (
    <>
      <div className={styles.shopHead}>
        {shop?.logoUrl
          ? <ApiImage src={shop.logoUrl} alt="" className={styles.logo} />
          : <span className={styles.logoEmpty} aria-hidden="true">🏪</span>}
        <div>
          <p className="eyebrow">Seller dashboard</p>
          <h1 className={styles.shopName}>
            {shop?.name ?? 'My shop'}
            {shop?.isVerified && <span className={styles.verified} title="Verified by Phloem">✓</span>}
          </h1>
        </div>
        {shop?.isLive && <Link to={`/shops/${shop.id}`} className={styles.viewShop}>See my shop as buyers do ›</Link>}
      </div>
      <SellerTabs newOrders={newOrders} />
    </>
  )
}

/**
 * What the seller must know about their shop's state: waiting for approval, rejected (with the reason), blocked,
 * or live but still missing documents for the ✓ badge. Nothing when all is well.
 */
export function ShopStatusBanner({ shop }: { shop: MyShopDto }) {
  const missing = shop.missingDocuments.map((d) => documentText[d]).join(', ')
  switch (shop.status) {
    case 'PendingApproval':
      return (
        <div className={`${styles.banner} ${styles.bannerWait}`}>
          <strong>Your shop is waiting for approval.</strong>
          <span>Phloem reviews new shops before they go live. Meanwhile, add your dishes and upload your documents
            in Shop settings{missing ? ` (still needed: ${missing})` : ''}.</span>
        </div>
      )
    case 'Rejected':
      return (
        <div className={`${styles.banner} ${styles.bannerStop}`}>
          <strong>Your shop wasn't approved yet.</strong>
          {shop.rejectionReason && <span>Phloem said: "{shop.rejectionReason}"</span>}
          <span>Fix it in Shop settings and it goes back for review.</span>
        </div>
      )
    case 'Blocked':
      return (
        <div className={`${styles.banner} ${styles.bannerStop}`}>
          <strong>Your shop is blocked.</strong>
          <span>Buyers can't see it. Please contact sellers@phloem.app.</span>
        </div>
      )
    default:
      return shop.isLive && !shop.isVerified && missing ? (
        <div className={`${styles.banner} ${styles.bannerInfo}`}>
          <strong>Get the ✓ badge</strong>
          <span>Shops with the badge get more orders. Upload in Shop settings: {missing}.</span>
        </div>
      ) : null
  }
}
