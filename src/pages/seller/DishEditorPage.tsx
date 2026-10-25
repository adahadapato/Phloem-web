import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { unwrap, type ApiError } from '../../api/apiError'
import type { DishCatalogItemDto, DishPhotoDto, MyDishDto } from '../../api/contracts/dtos'
import type { CatalogGroup, Country, DishCategory } from '../../api/contracts/enums'
import { getDishCatalog, suggestDishName } from '../../api/services/dishCatalogService'
import {
  addMyDishPhoto, createMyDish, deleteMyDish, getMyDishes, removeMyDishPhoto, updateMyDish,
} from '../../api/services/dishService'
import { ApiImage } from '../../components/ui/ApiImage'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { dishCategories } from '../../components/ui/labels'
import { Price } from '../../components/ui/Price'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { SellerHeader } from './SellerParts'
import styles from './Seller.module.css'
import { useMyShop } from './useMyShop'

/** Same limits as the API (Dish, DishCatalog, photos). */
const DETAIL_MAX = 40
const DESCRIPTION_MAX = 500
const NAME_MAX = 60
const MAX_PHOTOS = 5
const PHOTO_MAX_BYTES = 10 * 1024 * 1024
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

/** The picker's groups, in order, with the words sellers see. */
const GROUPS: { value: CatalogGroup; label: string }[] = [
  { value: 'Ghana', label: 'Ghanaian' },
  { value: 'Nigeria', label: 'Nigerian' },
  { value: 'WestAfrican', label: 'West African' },
  { value: 'Snacks', label: 'Snacks' },
  { value: 'Drinks', label: 'Drinks' },
]

/** A photo picked for a NEW dish: uploaded right after the dish is saved. */
interface QueuedPhoto {
  key: number
  file: File
  preview: string
}

/** Checks a picked photo before uploading (the API checks again: size, sharpness, at least 800×600). */
function photoProblem(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type) && !/\.(heic|heif)$/i.test(file.name)) {
    return `${file.name}: please choose a JPEG, PNG, WebP or HEIC photo.`
  }
  if (file.size > PHOTO_MAX_BYTES) return `${file.name} is larger than 10 MB. Please choose a smaller photo.`
  return null
}

/** "Can't find your dish?": suggest a name; Phloem checks it and adds it to the list for everyone. */
function SuggestName({ country }: { country: Country }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<DishCategory>('LocalMeals')
  const [group, setGroup] = useState<CatalogGroup>(country === 'Nigeria' ? 'Nigeria' : 'Ghana')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  if (!open) {
    return (
      <button type="button" className={styles.linkButton} onClick={() => setOpen(true)}>
        Can't find your dish? Suggest a new name
      </button>
    )
  }

  const send = async () => {
    if (!name.trim()) return setMessage({ text: 'Please type the dish name.', isError: true })
    setBusy(true)
    const result = await suggestDishName({ name: name.trim(), category, group })
    setBusy(false)
    if (result.ok) {
      setName('')
      setMessage({ text: 'Thanks! Phloem will check the name and add it to the list for everyone.', isError: false })
    } else {
      setMessage({ text: result.error.displayMessage, isError: true })
    }
  }

  return (
    <div className={styles.suggest}>
      <strong>Suggest a new name for the list</strong>
      <span className="muted">Phloem will check the name and add it to the list for everyone.</span>
      <Field label="Dish name" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} />
      <div className={styles.two}>
        <label className={styles.inline}>
          <span className={styles.label}>Category</span>
          <select className={styles.select} value={category} onChange={(e) => setCategory(e.target.value as DishCategory)}>
            {dishCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className={styles.inline}>
          <span className={styles.label}>Group</span>
          <select className={styles.select} value={group} onChange={(e) => setGroup(e.target.value as CatalogGroup)}>
            {GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </label>
      </div>
      <StatusBanner message={message?.text} isError={message?.isError} />
      <div className={styles.row}>
        <Button small busy={busy} busyText="Sending…" onClick={send}>Send for approval</Button>
        <Button small variant="outline" onClick={() => { setOpen(false); setMessage(null) }}>Close</Button>
      </div>
    </div>
  )
}

/** The form itself. Starts from the dish being edited (or empty for a new one); remounted per dish. */
function Editor({ dish, catalog, country }: { dish: MyDishDto | null; catalog: DishCatalogItemDto[]; country: Country }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const shop = useMyShop().data

  const [catalogId, setCatalogId] = useState<string | null>(dish?.dishCatalogId ?? null)
  const [picking, setPicking] = useState(!dish)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<DishCategory | 'All'>('All')
  const [detail, setDetail] = useState(dish?.detail ?? '')
  const [price, setPrice] = useState(dish ? String(dish.price) : '')
  const [description, setDescription] = useState(dish?.description ?? '')
  const [available, setAvailable] = useState(dish?.isAvailable ?? true)
  const [photos, setPhotos] = useState<DishPhotoDto[]>(dish?.photos ?? [])
  const [queued, setQueued] = useState<QueuedPhoto[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const picked = catalog.find((c) => c.id === catalogId)
  const currency = picked?.currency ?? dish?.currency ?? shop?.currency ?? 'GHS'
  const min = picked?.minPrice ?? dish?.allowedMinPrice ?? null
  const max = picked?.maxPrice ?? dish?.allowedMaxPrice ?? null
  const amount = Number(price.replace(',', '.'))
  const priceOk = price.trim() !== '' && amount > 0 && (min === null || amount >= min) && (max === null || amount <= max)
  const name = [picked?.name ?? dish?.catalogName ?? '', detail.trim()].filter(Boolean).join(' ')
  const photoCount = photos.length + queued.length

  const list = useMemo(() => {
    const text = search.trim().toLowerCase()
    return catalog.filter((c) => (category === 'All' || c.category === category) && (!text || c.name.toLowerCase().includes(text)))
  }, [catalog, search, category])

  const pick = (c: DishCatalogItemDto) => {
    setCatalogId(c.id)
    setPicking(false)
    setError(null)
  }

  const onPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    setMessage(null)
    const room = MAX_PHOTOS - photoCount
    if (files.length > room) {
      setMessage({ text: `A dish can have at most ${MAX_PHOTOS} photos.`, isError: true })
    }
    const problems: string[] = []
    const good = files.slice(0, Math.max(0, room)).filter((f) => {
      const p = photoProblem(f)
      if (p) problems.push(p)
      return !p
    })
    if (problems.length) setMessage({ text: problems.join('\n'), isError: true })
    if (!good.length) return

    if (!dish) {
      // New dish: keep them until it's saved
      setQueued((q) => [...q, ...good.map((file, i) => ({ key: Date.now() + i, file, preview: URL.createObjectURL(file) }))])
      return
    }
    // Existing dish: upload straight away, one by one, so each gets its own answer
    setBusy('photo')
    const failed: string[] = []
    for (const file of good) {
      const result = await addMyDishPhoto(dish.id, file)
      if (result.ok) setPhotos((list) => [...list, result.value])
      else failed.push(`${file.name}: ${result.error.displayMessage}`)
    }
    setBusy(null)
    await queryClient.invalidateQueries({ queryKey: ['seller', 'dishes'] })
    if (failed.length) setMessage({ text: failed.join('\n'), isError: true })
  }

  const removePhoto = async (photo: DishPhotoDto) => {
    if (!dish) return
    setBusy(`photo:${photo.id}`)
    const result = await removeMyDishPhoto(dish.id, photo.id)
    setBusy(null)
    if (result.ok) setPhotos((list) => list.filter((p) => p.id !== photo.id))
    else setMessage({ text: result.error.displayMessage, isError: true })
    await queryClient.invalidateQueries({ queryKey: ['seller', 'dishes'] })
  }

  const unqueue = (key: number) => setQueued((q) => {
    const gone = q.find((p) => p.key === key)
    if (gone) URL.revokeObjectURL(gone.preview)
    return q.filter((p) => p.key !== key)
  })

  const onSave = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    if (!catalogId) return setMessage({ text: 'Please choose a dish name from the list.', isError: true })
    if (!priceOk) {
      return setMessage({
        text: min !== null && max !== null
          ? `Please set a price between ${min.toFixed(2)} and ${max.toFixed(2)}.`
          : 'Please set a price.',
        isError: true,
      })
    }

    setBusy('save')
    const command = {
      dishCatalogId: catalogId, detail: detail.trim() || null, price: amount,
      description: description.trim() || null, isAvailable: available,
    }
    if (dish) {
      const result = await updateMyDish(dish.id, command)
      setBusy(null)
      if (!result.ok) return setError(result.error)
      await queryClient.invalidateQueries({ queryKey: ['seller', 'dishes'] })
      await navigate('/seller/dishes', { state: { notice: `${name} saved.` } })
      return
    }

    const created = await createMyDish(command)
    if (!created.ok) {
      setBusy(null)
      return setError(created.error)
    }
    const failed: string[] = []
    for (const photo of queued) {
      const result = await addMyDishPhoto(created.value, photo.file)
      if (!result.ok) failed.push(`${photo.file.name} (${result.error.displayMessage})`)
    }
    queued.forEach((p) => URL.revokeObjectURL(p.preview))
    setBusy(null)
    await queryClient.invalidateQueries({ queryKey: ['seller', 'dishes'] })
    await navigate('/seller/dishes', {
      state: { notice: failed.length
        ? `${name} added, but some photos didn't upload: ${failed.join(', ')}. Open the dish to try again.`
        : `${name} added.` },
    })
  }

  const onDelete = async () => {
    if (!dish) return
    setBusy('delete')
    const result = await deleteMyDish(dish.id)
    setBusy(null)
    if (!result.ok) return setMessage({ text: result.error.displayMessage, isError: true })
    await queryClient.invalidateQueries({ queryKey: ['seller', 'dishes'] })
    await navigate('/seller/dishes', { state: { notice: `${dish.name} was deleted. Past orders still show it.` } })
  }

  const main = photos.find((p) => p.isPrimary) ?? photos[0]
  const firstPhoto = main ? main.thumbnailUrl ?? main.url : null
  const previewPhoto = queued[0]?.preview ?? null

  return (
    <form className={styles.editorGrid} onSubmit={onSave} noValidate>
      <div className={styles.editorMain}>
        {/* ── Name ── */}
        <section className={styles.card} aria-labelledby="name-title">
          <h2 id="name-title" className={styles.cardTitle}>Dish name</h2>
          {picked && !picking ? (
            <div className={styles.pickedName}>
              <div>
                <strong>{picked.name}</strong>
                <span className="muted">
                  {dishCategories.find((c) => c.value === picked.category)?.label}
                  {picked.hasPriceRange && picked.minPrice !== null && picked.maxPrice !== null && (
                    <> · price <Price amount={picked.minPrice} currency={currency} className={styles.plain} />
                      {' – '}<Price amount={picked.maxPrice} currency={currency} className={styles.plain} /></>
                  )}
                </span>
              </div>
              <Button small variant="outline" onClick={() => setPicking(true)}>Change</Button>
            </div>
          ) : (
            <div className={styles.picker}>
              <input className={styles.pickerSearch} type="search" value={search} placeholder="Choose a dish: type to search"
                     aria-label="Search dish names" onChange={(e) => setSearch(e.target.value)} />
              <div className={styles.chips}>
                {(['All', ...dishCategories.map((c) => c.value)] as const).map((c) => (
                  <button key={c} type="button" className={styles.chip2} aria-pressed={category === c}
                          onClick={() => setCategory(c)}>
                    {c === 'All' ? 'All' : dishCategories.find((x) => x.value === c)?.label}
                  </button>
                ))}
              </div>
              <div className={styles.pickerList} role="listbox" aria-label="Dish names">
                {GROUPS.map((g) => {
                  const items = list.filter((c) => c.group === g.value)
                  if (!items.length) return null
                  return (
                    <div key={g.value}>
                      <p className={styles.groupTitle}>{g.label}</p>
                      {items.map((c) => (
                        <button key={c.id} type="button" role="option" aria-selected={c.id === catalogId}
                                className={styles.pickerItem} disabled={!c.hasPriceRange} onClick={() => pick(c)}>
                          <span>{c.name}</span>
                          <span className="muted">
                            {c.hasPriceRange && c.minPrice !== null && c.maxPrice !== null && c.currency
                              ? <><Price amount={c.minPrice} currency={c.currency} className={styles.plain} />
                                  {' – '}<Price amount={c.maxPrice} currency={c.currency} className={styles.plain} /></>
                              : 'price not set yet'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )
                })}
                {!list.length && <p className="muted">No dish with that name yet.</p>}
              </div>
              {picked && <Button small variant="outline" onClick={() => setPicking(false)}>Keep {picked.name}</Button>}
            </div>
          )}
          <SuggestName country={country} />
          <Field label="Add a detail" optional value={detail} maxLength={DETAIL_MAX} placeholder="e.g. & Chicken, Spicy"
                 onChange={(e) => setDetail(e.target.value)} hint="Shown after the name." error={error?.fieldError('Detail')} />
        </section>

        {/* ── Price & description ── */}
        <section className={styles.card} aria-labelledby="price-title">
          <h2 id="price-title" className={styles.cardTitle}>Price and description</h2>
          <Field label={`Price (${currency})`} type="number" inputMode="decimal" min={min ?? 0} max={max ?? undefined} step="0.5"
                 value={price} onChange={(e) => setPrice(e.target.value)} error={error?.fieldError('Price')}
                 hint={min !== null && max !== null ? `Allowed in your country: ${min.toFixed(2)} – ${max.toFixed(2)}` : undefined} />
          {dish?.needsPriceUpdate && (
            <p className={styles.warnBox}>Phloem changed the allowed range: set a price inside it to show this dish again.</p>
          )}
          <label className={styles.inline}>
            <span className={styles.label}>Short description <span className="muted">(optional)</span></span>
            <textarea className={styles.textarea} rows={3} value={description} maxLength={DESCRIPTION_MAX}
                      placeholder="What's in it, portion size, how spicy…" onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className={styles.switchRow}>
            <input type="checkbox" className={styles.switch} checked={available} onChange={(e) => setAvailable(e.target.checked)} />
            <span><strong>Available today</strong> <span className="muted">Turn off to hide it when sold out</span></span>
          </label>
        </section>

        {/* ── Photos ── */}
        <section className={styles.card} aria-labelledby="photos-title">
          <h2 id="photos-title" className={styles.cardTitle}>Photos <span className="muted">({photoCount} of {MAX_PHOTOS})</span></h2>
          <p className="muted" style={{ fontSize: 13 }}>
            Tip: use natural light · landscape works best · show the whole plate. JPEG, PNG, WebP or HEIC, up to 10 MB.
          </p>
          <div className={styles.photoGrid}>
            {photos.map((p, i) => (
              <div key={p.id} className={styles.photoTile}>
                <ApiImage src={p.thumbnailUrl ?? p.url} alt={p.altText || `Photo ${i + 1}`} className={styles.photoImg} />
                {p.isPrimary && <span className={styles.mainTag}>Main</span>}
                <button type="button" className={styles.photoRemove} aria-label={`Remove photo ${i + 1}`}
                        disabled={!!busy} onClick={() => removePhoto(p)}>✕</button>
              </div>
            ))}
            {queued.map((p, i) => (
              <div key={p.key} className={styles.photoTile}>
                <img src={p.preview} alt={`New photo ${i + 1}`} className={styles.photoImg} />
                {photos.length === 0 && i === 0 && <span className={styles.mainTag}>Main</span>}
                <button type="button" className={styles.photoRemove} aria-label={`Remove new photo ${i + 1}`}
                        onClick={() => unqueue(p.key)}>✕</button>
              </div>
            ))}
            {photoCount < MAX_PHOTOS && (
              <label className={styles.photoAdd}>
                <span aria-hidden="true">+</span>
                {busy === 'photo' ? 'Uploading…' : 'Add a photo'}
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,.heic" onChange={onPhotos}
                       disabled={busy === 'photo'} />
              </label>
            )}
          </div>
          {!dish && queued.length > 0 && <p className="muted" style={{ fontSize: 13 }}>Photos upload when you save the dish.</p>}
        </section>
      </div>

      {/* ── Preview and Save ── */}
      <aside className={styles.editorSide}>
        <div className={styles.card}>
          <p className={styles.label} style={{ margin: 0 }}>How customers will see it</p>
          <div className={styles.previewCard}>
            {previewPhoto ? <img src={previewPhoto} alt="" className={styles.previewImg} />
              : <ApiImage src={firstPhoto} alt="" className={styles.previewImg} />}
            <div className={styles.previewBody}>
              <strong>{name || 'Your dish'}</strong>
              <span className="muted">🌿 {shop?.name ?? 'Your shop'}</span>
              {priceOk ? <Price amount={amount} currency={currency} /> : <span className="muted">Set a price</span>}
              {!available && <span className={styles.warn}>Hidden from buyers</span>}
            </div>
          </div>
          <StatusBanner message={message?.text ?? (error ? error.displayMessage : null)} isError={message?.isError ?? true} />
          <Button type="submit" variant="cta" full busy={busy === 'save'} busyText="Saving…" disabled={!!busy && busy !== 'save'}>
            {dish ? 'Save dish' : 'Add dish'}
          </Button>
          <Link to="/seller/dishes" className={styles.strongLink} style={{ textAlign: 'center' }}>Cancel</Link>
          {dish && (confirmDelete ? (
            <div className={styles.confirmBox}>
              <strong>Delete {dish.name}?</strong>
              <span className="muted">Past orders still show it.</span>
              <div className={styles.row}>
                <Button small variant="cta" busy={busy === 'delete'} busyText="Deleting…" onClick={onDelete}>Delete</Button>
                <Button small variant="outline" onClick={() => setConfirmDelete(false)}>Keep it</Button>
              </div>
            </div>
          ) : (
            <button type="button" className={styles.dangerLink} onClick={() => setConfirmDelete(true)}>Delete dish</button>
          ))}
        </div>
      </aside>
    </form>
  )
}

/**
 * Add a dish (/seller/dishes/new) or change one (/seller/dishes/:dishId), like the app's dish editor:
 * pick the name from Phloem's list (searchable, by category, each with its price range in the shop's country;
 * "Can't find your dish?" suggests a new one), an optional detail, the price inside the range, a description,
 * up to 5 photos and "Available today". A preview shows how buyers will see it.
 */
export default function DishEditorPage() {
  const { dishId } = useParams()
  const shopQuery = useMyShop()
  const shop = shopQuery.data
  const catalog = useQuery({
    queryKey: ['dish-catalog', shop?.country],
    queryFn: async ({ signal }) => unwrap(await getDishCatalog(shop!.country, signal)),
    enabled: !!shop,
    staleTime: 10 * 60_000,
  })
  const dishes = useQuery({
    queryKey: ['seller', 'dishes'],
    queryFn: async ({ signal }) => unwrap(await getMyDishes(signal)),
    enabled: !!dishId,
    staleTime: 15_000,
  })
  const dish = dishId ? dishes.data?.dishes.find((d) => d.id === dishId) ?? null : null
  const loading = shopQuery.isPending || catalog.isPending || (!!dishId && dishes.isPending)
  const failed = shopQuery.isError || catalog.isError || dishes.isError

  return (
    <div className={`container ${styles.page}`}>
      <SellerHeader shop={shop} />
      <Link to="/seller/dishes" className={styles.strongLink}>‹ My dishes</Link>
      <h2 className={styles.editorTitle}>{dishId ? (dish ? `Edit ${dish.name}` : 'Edit dish') : 'Add a dish'}</h2>

      {loading && !failed && <div className={styles.card} aria-busy="true"><p className="muted">Loading…</p></div>}
      {failed && <StatusBanner isError message="We couldn't load the dish list. Please try again." />}
      {!loading && !failed && dishId && !dish && (
        <StatusBanner isError message="That dish wasn't found. It may have been deleted." />
      )}
      {!loading && !failed && shop && catalog.data && (!dishId || dish) && (
        <Editor key={dish?.id ?? 'new'} dish={dish} catalog={catalog.data} country={shop.country} />
      )}
    </div>
  )
}
