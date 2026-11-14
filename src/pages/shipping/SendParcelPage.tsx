import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { unwrap, type ApiError } from '../../api/apiError'
import type { BookedShipmentDto, ShipmentRouteOptionDto } from '../../api/contracts/dtos'
import type { Country, DeliverySpeed, ParcelDelivery, ParcelHandOver, ShipmentItemCategory } from '../../api/contracts/enums'
import { bookShipment, getShipmentQuote, getShipmentRoutes } from '../../api/services/shipmentService'
import { Button, ButtonLink } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field } from '../../components/ui/Field'
import { shipmentCategories } from '../../components/ui/labels'
import { Price } from '../../components/ui/Price'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { useCountry } from '../../state/CountryContext'
import { useSession } from '../../state/SessionContext'
import { ParcelRules } from './ParcelRules'
import { RouteText } from './ShipmentParts'
import styles from './Shipping.module.css'
import { NeedHelp } from '../../components/ui/NeedHelp'
import { usePageSeo } from '../../components/layout/usePageSeo'
import { BoxList } from './parcel/BoxList'
import { LocationFields } from './parcel/LocationFields'
import { emptyPlace, type PlaceDraft } from './parcel/place'
import { PriceBreakdown } from './parcel/PriceBreakdown'
import { figures, newBox, toNumber, type BoxDraft } from './parcel/parcelMath'
import parcel from './parcel/Parcel.module.css'
import { CustomerReviews } from '../../components/reviews/CustomerReviews'

/** Same limits as the API (Shipment / ShipmentItem). */
const MAX_KG = 1000
const MAX_ITEMS = 50
const emptyPickup = { addressLine: '', city: '', postcode: '', notes: '' }

/** One item row as typed (numbers stay text until sent, so the boxes can be empty while typing). */
interface ItemDraft {
  key: number
  category: ShipmentItemCategory
  description: string
  quantity: string
  value: string
}

const routeKey = (r: { fromCountry: Country; toCountry: Country }) => `${r.fromCountry}>${r.toCountry}`
const newItem = (key: number): ItemDraft => ({ key, category: 'PackagedFood', description: '', quantity: '1', value: '' })
const days = (min: number, max: number) => (min === max ? `${min} days` : `${min}–${max} days`)

/** "Booked!": the tracking number, where to drop the parcel and what happens next. */
function Booked({ booked, onAnother }: { booked: BookedShipmentDto; onAnother: () => void }) {
  return (
    <div className={`container ${styles.page}`}>
      <div className={`${styles.narrow} ${styles.done}`}>
        <span className={styles.tick} aria-hidden="true">✓</span>
        <h1>Parcel booked</h1>
        <p className="muted">Tracking number</p>
        <p className={styles.bigNumber}>{booked.trackingNumber}</p>
        <section className={styles.card}>
          {booked.handOver === 'HomePickup' ? (
            <>
              <h2 className={styles.sectionTitle}>We'll collect it from you</h2>
              <p>Our team will call you to arrange a pickup time. Please have the parcel packed, taped and labelled.</p>
            </>
          ) : (
            <>
              <h2 className={styles.sectionTitle}>Drop it off at</h2>
              <p style={{ whiteSpace: 'pre-line' }}><strong>{booked.dropOffAddress}</strong></p>
              <p className="muted">{booked.dropOffHours}</p>
            </>
          )}
          <p className={styles.note}>
            Write the tracking number on every box. We'll weigh and measure them at the hub; then pay the final price
            from My shipments. Estimated price: <Price amount={booked.estimatedPrice} currency={booked.currency} />.
          </p>
          {booked.delivery === 'CollectFromHub' && booked.collectionHubAddress && (
            <p className={styles.note}>
              The recipient collects it from <strong>{booked.collectionHubAddress}</strong> ({booked.collectionHubHours}).
              We'll tell them when it's ready.
            </p>
          )}
        </section>
        <div className={styles.actions}>
          <ButtonLink to={`/shipments/${encodeURIComponent(booked.trackingNumber)}`}>View my parcel</ButtonLink>
          <Button variant="secondary" onClick={onAnother}>Send another parcel</Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Send a parcel, like the app's "Send food to the UK" page but laid out for a big screen: the form on the left in
 * numbered sections (route and speed, boxes, what's inside, getting it to us, recipient, your phone, confirmations)
 * and the live price, part by part, on the right. Each box is charged as the higher of its weight and its size
 * (explained on the page). Anyone can look at routes and prices; booking needs an account with date of birth and
 * home address (18 or over), as the API requires. The final price is set when the boxes are weighed and measured
 * at the hub.
 */
export default function SendParcelPage() {
  usePageSeo('/send-parcel')
  const { status, profile } = useSession()
  const { countries, selected } = useCountry()
  const queryClient = useQueryClient()

  const routesQuery = useQuery({
    queryKey: ['shipment-routes'],
    queryFn: async ({ signal }) => unwrap(await getShipmentRoutes(signal)),
    staleTime: 10 * 60_000,
  })
  const routes = routesQuery.data ?? []

  // ── The form ──
  const [pickedRoute, setPickedRoute] = useState<string | null>(null)
  const [pickedSpeed, setPickedSpeed] = useState<DeliverySpeed | null>(null)
  const [boxes, setBoxes] = useState<BoxDraft[]>([newBox(1)])
  const [fragile, setFragile] = useState(false)
  const [handOver, setHandOver] = useState<ParcelHandOver>('HubDropOff')
  const [pickup, setPickup] = useState(emptyPickup)
  const [delivery, setDelivery] = useState<ParcelDelivery>('ToDoor')
  const [items, setItems] = useState<ItemDraft[]>([newItem(1)])
  const [recipient, setRecipient] = useState({ name: '', phone: '', addressLine: '' })
  const [place, setPlace] = useState<PlaceDraft>(emptyPlace)
  const [senderPhone, setSenderPhone] = useState<string | null>(null)
  const [noProhibited, setNoProhibited] = useState(false)
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [booked, setBooked] = useState<BookedShipmentDto | null>(null)

  // The picked route, else one from the person's country, else the first
  const route: ShipmentRouteOptionDto | undefined =
    routes.find((r) => routeKey(r) === pickedRoute)
    ?? routes.find((r) => r.fromCountry === selected?.country)
    ?? routes[0]
  const speed = route?.speeds.find((s) => s.speed === pickedSpeed) ?? route?.speeds[0]
  const phone = senderPhone ?? profile?.phoneNumber ?? ''
  const symbol = countries.find((c) => c.currency === route?.currency)?.currencySymbol ?? ''
  const destination = countries.find((c) => c.country === route?.toCountry)
  const divisor = route?.volumeDivisor ?? 5000
  // A choice the route no longer offers falls back to the free one
  const pickupOffered = route?.homePickupCharge != null
  const collectionOffered = !!route?.collectionHubAddress
  const handOverChoice: ParcelHandOver = handOver === 'HomePickup' && pickupOffered ? 'HomePickup' : 'HubDropOff'
  const deliveryChoice: ParcelDelivery = delivery === 'CollectFromHub' && collectionOffered ? 'CollectFromHub' : 'ToDoor'

  // ── Live price for the boxes and choices ──
  const boxFigures = boxes.map((b) => figures(b, divisor))
  const totalKg = boxFigures.reduce((sum, f) => sum + (Number.isNaN(f.weightKg) ? 0 : f.weightKg * f.quantity), 0)
  const boxesOk = boxFigures.every((f) => f.valid) && totalKg <= MAX_KG
  const boxInputs = boxes.map((b) => {
    const f = figures(b, divisor)
    return {
      weightKg: f.weightKg,
      lengthCm: f.hasSize ? toNumber(b.length) : null,
      widthCm: f.hasSize ? toNumber(b.width) : null,
      heightCm: f.hasSize ? toNumber(b.height) : null,
      quantity: f.quantity,
    }
  })
  const quoteInput = useDeferredValue(route && speed && boxesOk
    ? {
        fromCountry: route.fromCountry, toCountry: route.toCountry, speed: speed.speed, boxes: boxInputs,
        isFragile: fragile, handOver: handOverChoice, delivery: deliveryChoice,
        recipientRegionId: route.hasLocationList ? place.regionId : null,
      }
    : null)
  const quoteQuery = useQuery({
    queryKey: ['shipment-quote', quoteInput],
    queryFn: async ({ signal }) => unwrap(await getShipmentQuote(quoteInput!, signal)),
    enabled: !!quoteInput,
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  })
  const quote = quoteInput ? quoteQuery.data : undefined

  if (booked) {
    return <Booked booked={booked} onAnother={() => {
      setBooked(null); setBoxes([newBox(1)]); setFragile(false); setItems([newItem(1)]); setNoProhibited(false)
      setTerms(false); setRecipient({ name: '', phone: '', addressLine: '' }); setPlace(emptyPlace)
    }} />
  }

  if (routesQuery.isSuccess && routes.length === 0) {
    return (
      <div className={`container ${styles.page}`}>
        <EmptyState icon="cart" title="Parcels aren't available yet"
                    text="No shipping route is switched on at the moment. Please check again soon."
                    action={<ButtonLink to="/" variant="secondary">Back to Home</ButtonLink>} />
      </div>
    )
  }

  const signedIn = status === 'signedIn'
  const needsDetails = signedIn && profile && !profile.hasPersonalDetails
  const fieldError = (name: string) => error?.fieldError(name)
  const setItem = (key: number, change: Partial<ItemDraft>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...change } : i)))

  const onBook = async (event: FormEvent) => {
    event.preventDefault()
    if (!route || !speed) return
    setError(null)
    setLocalError(null)
    if (!boxesOk) {
      return setLocalError(totalKg > MAX_KG
        ? `A parcel can weigh at most ${MAX_KG} kg in total. Please send it as two parcels.`
        : 'Please check your boxes: each needs a weight, and either all three sides or none.')
    }
    if (items.some((i) => !i.description.trim())) return setLocalError('Please describe every item in the parcel.')
    if (handOverChoice === 'HomePickup' && (!pickup.addressLine.trim() || !pickup.city.trim() || !pickup.postcode.trim())) {
      return setLocalError('Please give the address where we should collect your parcel.')
    }
    if (route.hasLocationList && (!place.regionId || !place.districtId)) {
      return setLocalError("Please choose the recipient's state and LGA.")
    }

    setBusy(true)
    const result = await bookShipment({
      fromCountry: route.fromCountry,
      toCountry: route.toCountry,
      senderPhone: phone.trim(),
      recipientName: recipient.name.trim(),
      recipientPhone: recipient.phone.trim(),
      recipientAddressLine: recipient.addressLine.trim(),
      recipientCity: place.town.trim(),
      recipientRegionOrPostcode: route.hasLocationList ? place.regionName : place.postcode.trim(),
      items: items.map((i) => ({
        category: i.category,
        description: i.description.trim(),
        quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
        unitDeclaredValue: Math.max(0, Number(i.value.replace(',', '.')) || 0),
      })),
      speed: speed.speed,
      estimatedWeightKg: null,
      confirmedNoProhibitedItems: noProhibited,
      acceptedTerms: terms,
      boxes: boxInputs,
      isFragile: fragile,
      handOver: handOverChoice,
      pickup: handOverChoice === 'HomePickup'
        ? { addressLine: pickup.addressLine.trim(), city: pickup.city.trim(), regionOrPostcode: pickup.postcode.trim(),
            notes: pickup.notes.trim() || null }
        : null,
      delivery: deliveryChoice,
      recipientRegionId: route.hasLocationList ? place.regionId : null,
      recipientDistrictId: route.hasLocationList ? place.districtId : null,
      recipientTownId: route.hasLocationList ? place.townId : null,
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    void queryClient.invalidateQueries({ queryKey: ['shipments'] })
    setBooked(result.value)
    globalThis.scrollTo?.({ top: 0 })
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.heading}>
        <p className="eyebrow">Parcels</p>
        <h1>Send a parcel</h1>
        <p className="muted">
          Send a parcel between the United Kingdom, Ghana and Nigeria. Book online and get a price estimate, drop the
          parcel at our hub (or we collect it from you), we weigh and measure it and set the final price, then track it
          to the door. Check below what can and can't be sent.
        </p>
      </div>

      <ol className={styles.howSteps} aria-label="How it works">
        <li><strong>1</strong> Book here</li>
        <li><strong>2</strong> Drop it at the hub, or we collect it</li>
        <li><strong>3</strong> We weigh and measure it, you pay the final price</li>
        <li><strong>4</strong> We deliver it</li>
      </ol>

      {status === 'signedOut' && (
        <div className={styles.banner}>
          <span>You can look at routes and prices now; booking needs an account.</span>
          <span className={styles.bannerLinks}>
            <Link to="/login?returnTo=%2Fsend-parcel">Log in</Link>
            <Link to="/register?returnTo=%2Fsend-parcel">Sign up</Link>
          </span>
        </div>
      )}
      {needsDetails && (
        <div className={styles.banner}>
          <span>Before your first parcel, add your date of birth and home address (senders must be 18 or over).</span>
          <span className={styles.bannerLinks}><Link to="/account/edit?returnTo=/send-parcel">Add them now</Link></span>
        </div>
      )}

      {routesQuery.isPending && <div className={styles.card} aria-busy="true"><p className="muted">Loading routes…</p></div>}
      {routesQuery.isError && (
        <div className={styles.card}>
          <StatusBanner isError message="We couldn't load the shipping routes." />
          <div><Button small variant="outline" onClick={() => routesQuery.refetch()}>Try again</Button></div>
        </div>
      )}

      {route && speed && (
        <form className={styles.layout} onSubmit={onBook} noValidate>
          <div className={styles.main}>
            {/* 1. Route and speed */}
            <section className={styles.card} aria-labelledby="s1">
              <h2 id="s1" className={styles.sectionTitle}><span className={styles.num}>1</span> Where and how fast</h2>
              <label className={styles.label} htmlFor="route">From → To</label>
              <select id="route" className={styles.select} value={routeKey(route)}
                      onChange={(e) => { setPickedRoute(e.target.value); setPickedSpeed(null) }}>
                {routes.map((r) => {
                  const name = (c: Country) => countries.find((x) => x.country === c)?.name ?? c
                  return <option key={routeKey(r)} value={routeKey(r)}>{name(r.fromCountry)} → {name(r.toCountry)}</option>
                })}
              </select>
              <p className={styles.label}>Delivery speed</p>
              <div className={styles.choices} role="radiogroup" aria-label="Delivery speed">
                {route.speeds.map((s) => (
                  <button key={s.speed} type="button" role="radio" aria-checked={s.speed === speed.speed}
                          className={styles.choice} onClick={() => setPickedSpeed(s.speed)}>
                    <strong>{s.speed}</strong>
                    <span><Price amount={s.baseCharge} currency={route.currency} className={styles.plain} />
                      {' + '}<Price amount={s.pricePerKg} currency={route.currency} className={styles.plain} />/kg</span>
                    <span className="muted">Usually {days(s.minTransitDays, s.maxTransitDays)}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* 2. Boxes */}
            <section className={styles.card} aria-labelledby="s2">
              <h2 id="s2" className={styles.sectionTitle}><span className={styles.num}>2</span> Your boxes</h2>
              <BoxList boxes={boxes} onChange={setBoxes} divisor={divisor} fieldError={(name) => fieldError(name)} />
              <label className={parcel.fragile}>
                <input type="checkbox" checked={fragile} onChange={(e) => setFragile(e.target.checked)} />
                <span>
                  <strong>Fragile: handle with care</strong>
                  {route.fragileCharge > 0 && <> (+<Price amount={route.fragileCharge} currency={route.currency} className={styles.plain} />)</>}
                  <br /><span className="muted">Glass jars, bottles or electronics. We label the boxes and keep them on top.</span>
                </span>
              </label>
            </section>

            {/* 3. Items */}
            <section className={styles.card} aria-labelledby="s3">
              <h2 id="s3" className={styles.sectionTitle}><span className={styles.num}>3</span> What's in the parcel</h2>
              <p className="muted" style={{ fontSize: 13 }}>For customs. Values are for ONE item, in {symbol || route.currency}.</p>
              {items.map((item, index) => (
                <fieldset key={item.key} className={styles.item}>
                  <legend className="visually-hidden">Item {index + 1}</legend>
                  <div className={styles.itemGrid}>
                    <label className={styles.inline}>
                      <span className={styles.label}>Type</span>
                      <select className={styles.select} value={item.category}
                              onChange={(e) => setItem(item.key, { category: e.target.value as ShipmentItemCategory })}>
                        {shipmentCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </label>
                    <Field label="Description" value={item.description} maxLength={200} placeholder="e.g. Gari, 2 kg bags"
                           onChange={(e) => setItem(item.key, { description: e.target.value })}
                           error={fieldError(`Items[${index}].Description`)} />
                    <Field label="How many" type="number" inputMode="numeric" min={1} max={1000} value={item.quantity}
                           onChange={(e) => setItem(item.key, { quantity: e.target.value })}
                           error={fieldError(`Items[${index}].Quantity`)} />
                    <Field label={`Value each (${symbol || route.currency})`} type="number" inputMode="decimal" min={0}
                           step="0.01" value={item.value} placeholder="0.00"
                           onChange={(e) => setItem(item.key, { value: e.target.value })}
                           error={fieldError(`Items[${index}].UnitDeclaredValue`)} />
                  </div>
                  {items.length > 1 && (
                    <button type="button" className={styles.remove}
                            onClick={() => setItems((list) => list.filter((i) => i.key !== item.key))}>
                      Remove
                    </button>
                  )}
                </fieldset>
              ))}
              {items.length < MAX_ITEMS && (
                <div>
                  <Button small variant="secondary"
                          onClick={() => setItems((list) => [...list, newItem(Math.max(...list.map((i) => i.key)) + 1)])}>
                    + Add another item
                  </Button>
                </div>
              )}
            </section>

            {/* 4. Getting it to us */}
            <section className={styles.card} aria-labelledby="s4">
              <h2 id="s4" className={styles.sectionTitle}><span className={styles.num}>4</span> Getting it to us</h2>
              <div className={styles.choices} role="radiogroup" aria-label="How we get your parcel">
                <button type="button" role="radio" aria-checked={handOverChoice === 'HubDropOff'} className={styles.choice}
                        onClick={() => setHandOver('HubDropOff')}>
                  <strong>I'll drop it off</strong>
                  <span>No extra charge</span>
                  <span className={`muted ${parcel.optionNote}`}>{route.dropOffAddress}{'\n'}{route.dropOffHours}</span>
                </button>
                <button type="button" role="radio" aria-checked={handOverChoice === 'HomePickup'} className={styles.choice}
                        disabled={!pickupOffered} aria-disabled={!pickupOffered}
                        onClick={() => setHandOver('HomePickup')}>
                  <strong>Collect it from me</strong>
                  {pickupOffered
                    ? <><span>+<Price amount={route.homePickupCharge!} currency={route.currency} className={styles.plain} /></span>
                        <span className="muted">We call you to arrange a time</span></>
                    : <span className="muted">Not available on this route yet</span>}
                </button>
              </div>
              {handOverChoice === 'HomePickup' && (
                <>
                  <Field label="Street and house number" autoComplete="street-address" maxLength={300} value={pickup.addressLine}
                         onChange={(e) => setPickup({ ...pickup, addressLine: e.target.value })}
                         error={fieldError('Pickup.AddressLine')} />
                  <div className={parcel.two}>
                    <Field label="City or town" autoComplete="address-level2" maxLength={100} value={pickup.city}
                           onChange={(e) => setPickup({ ...pickup, city: e.target.value })} error={fieldError('Pickup.City')} />
                    <Field label={route.fromCountry === 'UnitedKingdom' ? 'Postcode' : 'Region'} autoComplete="postal-code"
                           maxLength={50} value={pickup.postcode}
                           onChange={(e) => setPickup({ ...pickup, postcode: e.target.value })}
                           error={fieldError('Pickup.RegionOrPostcode')} />
                  </div>
                  <Field label="Notes for the driver" optional maxLength={300} value={pickup.notes}
                         placeholder="e.g. Ring the top bell; weekday evenings are best"
                         onChange={(e) => setPickup({ ...pickup, notes: e.target.value })} error={fieldError('Pickup.Notes')} />
                </>
              )}
            </section>

            {/* 5. Recipient */}
            <section className={styles.card} aria-labelledby="s5">
              <h2 id="s5" className={styles.sectionTitle}>
                <span className={styles.num}>5</span> Who it's for {destination && <span className="muted">in {destination.name}</span>}
              </h2>
              <div className={styles.two}>
                <Field label="Full name" autoComplete="off" maxLength={100} value={recipient.name}
                       onChange={(e) => setRecipient({ ...recipient, name: e.target.value })}
                       error={fieldError('RecipientName')} />
                <Field label="Phone number" type="tel" autoComplete="off" value={recipient.phone}
                       placeholder={route.toCountry === 'UnitedKingdom' ? '+44 7700 900123' : route.toCountry === 'Nigeria' ? '+234 803 123 4567' : '+233 24 555 0192'}
                       onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })}
                       error={fieldError('RecipientPhone')} />
              </div>
              <LocationFields country={route.toCountry} hasList={route.hasLocationList} place={place} onChange={setPlace}
                              fieldError={(name) => fieldError(name)} />
              <p className={parcel.choiceTitle}>How it reaches them</p>
              <div className={styles.choices} role="radiogroup" aria-label="How it reaches them">
                <button type="button" role="radio" aria-checked={deliveryChoice === 'ToDoor'} className={styles.choice}
                        onClick={() => setDelivery('ToDoor')}>
                  <strong>Delivered to their door</strong>
                  <span className="muted">{quote && quote.doorDeliveryCharge > 0
                    ? <>+<Price amount={quote.doorDeliveryCharge} currency={quote.currency} className={styles.plain} />{quote.deliveryZoneName ? ` (${quote.deliveryZoneName})` : ''}</>
                    : route.hasLocationList && !place.regionId ? 'Charge depends on the state' : 'A courier brings it to the address below'}</span>
                </button>
                <button type="button" role="radio" aria-checked={deliveryChoice === 'CollectFromHub'} className={styles.choice}
                        disabled={!collectionOffered} aria-disabled={!collectionOffered}
                        onClick={() => setDelivery('CollectFromHub')}>
                  <strong>They collect it from our hub</strong>
                  {collectionOffered
                    ? <><span>No delivery charge</span>
                        <span className={`muted ${parcel.optionNote}`}>{route.collectionHubAddress}{'\n'}{route.collectionHubHours}</span></>
                    : <span className="muted">Not available on this route yet</span>}
                </button>
              </div>
              {deliveryChoice === 'ToDoor' && (
                <Field label="Street and house number" autoComplete="off" maxLength={300} value={recipient.addressLine}
                       onChange={(e) => setRecipient({ ...recipient, addressLine: e.target.value })}
                       error={fieldError('RecipientAddressLine')} />
              )}
            </section>

            {/* 6. Sender's phone */}
            <section className={styles.card} aria-labelledby="s6">
              <h2 id="s6" className={styles.sectionTitle}><span className={styles.num}>6</span> Your phone number</h2>
              <Field label="So the hub can reach you about this parcel" type="tel" autoComplete="tel" value={phone}
                     placeholder="+233 24 555 0192" onChange={(e) => setSenderPhone(e.target.value)}
                     error={fieldError('SenderPhone')} />
            </section>

            {/* 7. Confirm */}
            <section className={styles.card} aria-labelledby="s7">
              <h2 id="s7" className={styles.sectionTitle}><span className={styles.num}>7</span> Please confirm</h2>
              <ParcelRules />
              <label className={styles.check}>
                <input type="checkbox" checked={noProhibited} onChange={(e) => setNoProhibited(e.target.checked)} />
                <span>My parcel contains none of the items we can't carry, and follows the conditions above.</span>
              </label>
              <label className={styles.check}>
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                <span>I accept the <a href="/terms#parcels" target="_blank" rel="noopener">shipping terms</a>.</span>
              </label>
              <NeedHelp text="Questions about prices, weighing or customs?" section="parcels" />
            </section>
          </div>

          {/* ── Price and Book ── */}
          <aside className={styles.side} aria-label="Price">
            <div className={styles.card}>
              <RouteText from={route.fromCountry} to={route.toCountry} />
              <dl className={styles.sums}>
                <dt>Speed</dt><dd>{speed.speed}</dd>
                <dt>Usually</dt><dd>{days(speed.minTransitDays, speed.maxTransitDays)}</dd>
                <dt>We get it</dt><dd>{handOverChoice === 'HomePickup' ? 'Collected from you' : 'You drop it off'}</dd>
                <dt>They get it</dt><dd>{deliveryChoice === 'CollectFromHub' ? 'Collect from our hub' : 'Delivered to the door'}</dd>
              </dl>
              {quote && <PriceBreakdown quote={quote} />}
              <div className={styles.total}>
                <span>Estimated price</span>
                {quote ? <Price amount={quote.estimatedPrice} currency={quote.currency} />
                  : <span className="muted" style={{ fontSize: 14 }}>{boxesOk ? 'Working it out…' : 'Enter your boxes'}</span>}
              </div>
              {quoteInput && quoteQuery.isError && (
                <StatusBanner isError message={(quoteQuery.error as { displayMessage?: string } | null)?.displayMessage ?? "We couldn't work out the price."} />
              )}
              <p className="muted" style={{ fontSize: 13 }}>
                The final price is set when we weigh and measure your boxes at the hub.
                {route.hasLocationList && !place.regionId && deliveryChoice === 'ToDoor' && ' Door delivery is added once you choose the state.'}
              </p>
              {handOverChoice === 'HubDropOff' && (
                <div className={styles.dropOff}>
                  <strong>Drop it off at</strong>
                  <span style={{ whiteSpace: 'pre-line' }}>{route.dropOffAddress}</span>
                  <span className="muted">{route.dropOffHours}</span>
                </div>
              )}
              <StatusBanner isError message={localError ?? (error ? error.displayMessage : null)} />
              {signedIn ? (
                <Button type="submit" variant="cta" full busy={busy} busyText="Booking…" disabled={!!needsDetails}>
                  Book parcel
                </Button>
              ) : (
                <ButtonLink to="/login?returnTo=%2Fsend-parcel" variant="cta" full>Log in to book</ButtonLink>
              )}
            </div>
          </aside>
        </form>
      )}
      <CustomerReviews kind="Parcel" eyebrow="Parcel reviews" title="What senders say" compact />
    </div>
  )
}
