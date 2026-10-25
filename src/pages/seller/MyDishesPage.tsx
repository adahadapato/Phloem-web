import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { unwrap } from '../../api/apiError'
import type { MyDishDto } from '../../api/contracts/dtos'
import { deleteMyDish, getMyDishes, updateMyDish } from '../../api/services/dishService'
import { ApiImage } from '../../components/ui/ApiImage'
import { Button, ButtonLink } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { dishCategories } from '../../components/ui/labels'
import { Price } from '../../components/ui/Price'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { SellerHeader } from './SellerParts'
import styles from './Seller.module.css'
import { useMyShop } from './useMyShop'

type Message = { text: string; isError: boolean } | null

/** The dish's main photo (small version), if it has any. */
const thumb = (d: MyDishDto) => {
  const p = d.photos.find((x) => x.isPrimary) ?? d.photos[0]
  return p ? p.thumbnailUrl ?? p.url : null
}

/**
 * My dishes (/seller/dishes): every dish as a card with its photo, price, allowed range and state, an "Available
 * today" switch (off hides it when sold out), Edit, and Delete (asks first; past orders still show the dish).
 * Dishes that need a new price come first (the API sorts them), flagged in orange.
 */
export default function MyDishesPage() {
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const queryClient = useQueryClient()
  const shop = useMyShop().data
  const query = useQuery({
    queryKey: ['seller', 'dishes'],
    queryFn: async ({ signal }) => unwrap(await getMyDishes(signal)),
    staleTime: 15_000,
  })
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [message, setMessage] = useState<Message>(notice ? { text: notice, isError: false } : null)

  const dishes = query.data?.dishes ?? []
  const needPrice = query.data?.needsPriceUpdateCount ?? 0

  const run = async (key: string, action: () => Promise<{ ok: boolean; error?: { displayMessage: string } }>, done: string) => {
    setBusy(key)
    setMessage(null)
    const result = await action()
    await queryClient.invalidateQueries({ queryKey: ['seller', 'dishes'] })
    setBusy(null)
    setMessage(result.ok ? { text: done, isError: false } : { text: result.error!.displayMessage, isError: true })
  }

  const toggle = (d: MyDishDto) => run(`toggle:${d.id}`, () => updateMyDish(d.id, {
    dishCatalogId: d.dishCatalogId, detail: d.detail, price: d.price, description: d.description, isAvailable: !d.isAvailable,
  }), d.isAvailable ? `${d.name} is hidden from buyers.` : `${d.name} is on sale again.`)

  const remove = (d: MyDishDto) => {
    setConfirmDelete(null)
    return run(`delete:${d.id}`, () => deleteMyDish(d.id), `${d.name} was deleted. Past orders still show it.`)
  }

  return (
    <div className={`container ${styles.page}`}>
      <SellerHeader shop={shop} />

      <div className={styles.cardHead} style={{ marginBottom: 14 }}>
        <div>
          <h2 className={styles.cardTitle}>My dishes</h2>
          <p className="muted">{dishes.length} {dishes.length === 1 ? 'dish' : 'dishes'}</p>
        </div>
        <ButtonLink to="/seller/dishes/new" variant="cta" small>+ Add dish</ButtonLink>
      </div>

      {message && <StatusBanner message={message.text} isError={message.isError} />}
      {needPrice > 0 && (
        <p className={styles.warnBox} style={{ marginBottom: 14 }}>
          {needPrice} {needPrice === 1 ? 'dish needs' : 'dishes need'} a new price: Phloem changed the allowed range,
          so {needPrice === 1 ? "it's" : "they're"} hidden from buyers until you update {needPrice === 1 ? 'it' : 'them'}.
        </p>
      )}

      {query.isPending && <div className={styles.card} aria-busy="true"><p className="muted">Loading your dishes…</p></div>}
      {query.isError && (
        <div className={styles.card}>
          <StatusBanner isError message="We couldn't load your dishes." />
          <div><Button small variant="outline" onClick={() => query.refetch()}>Try again</Button></div>
        </div>
      )}
      {query.isSuccess && dishes.length === 0 && (
        <EmptyState icon="cart" title="Add your first dish" text="Pick the dish, add a photo and set your price."
                    action={<ButtonLink to="/seller/dishes/new">+ Add dish</ButtonLink>} />
      )}

      <ul className={styles.dishGrid}>
        {dishes.map((d) => (
          <li key={d.id} className={`${styles.dishCard} ${d.needsPriceUpdate ? styles.dishCardWarn : ''}`}
              aria-label={d.name}>
            <div className={styles.dishPhotoWrap}>
              <ApiImage src={thumb(d)} alt="" className={styles.dishPhoto} />
              {!d.isAvailable && <span className={styles.hiddenTag}>Hidden</span>}
            </div>
            <div className={styles.dishBody}>
              <strong className={styles.dishCardName}>{d.name}</strong>
              <span className="muted">
                {dishCategories.find((c) => c.value === d.category)?.label}
                {d.ratingCount > 0 && ` · ★ ${d.rating.toFixed(1)} (${d.ratingCount})`}
                {` · ${d.photos.length} ${d.photos.length === 1 ? 'photo' : 'photos'}`}
              </span>
              <span className={styles.dishPriceLine}>
                <Price amount={d.price} currency={d.currency} />
                {d.allowedMinPrice !== null && d.allowedMaxPrice !== null && (
                  <span className="muted">
                    allowed <Price amount={d.allowedMinPrice} currency={d.currency} className={styles.plain} />
                    {' – '}<Price amount={d.allowedMaxPrice} currency={d.currency} className={styles.plain} />
                  </span>
                )}
              </span>
              {d.needsPriceUpdate && <span className={styles.warn}>Needs a new price: open it to update</span>}

              <label className={styles.switchRow}>
                <input type="checkbox" className={styles.switch} checked={d.isAvailable} disabled={!!busy}
                       onChange={() => toggle(d)} />
                <span>Available today</span>
              </label>

              {confirmDelete === d.id ? (
                <div className={styles.confirmBox} role="group" aria-label={`Delete ${d.name}?`}>
                  <strong>Delete {d.name}?</strong>
                  <span className="muted">Past orders still show it.</span>
                  <div className={styles.row}>
                    <Button small variant="cta" busy={busy === `delete:${d.id}`} busyText="Deleting…" onClick={() => remove(d)}>
                      Delete
                    </Button>
                    <Button small variant="outline" onClick={() => setConfirmDelete(null)}>Keep it</Button>
                  </div>
                </div>
              ) : (
                <div className={styles.row}>
                  <ButtonLink to={`/seller/dishes/${d.id}`} small variant={d.needsPriceUpdate ? 'cta' : 'secondary'}>
                    {d.needsPriceUpdate ? 'Update price' : 'Edit'}
                  </ButtonLink>
                  <Button small variant="outline" disabled={!!busy} onClick={() => setConfirmDelete(d.id)}>Delete</Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {shop?.isLive && dishes.length > 0 && (
        <p className="muted" style={{ marginTop: 12 }}>
          <Link to={`/shops/${shop.id}`} className={styles.strongLink}>See your menu as buyers do ›</Link>
        </p>
      )}
    </div>
  )
}
