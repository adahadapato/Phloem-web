import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { cancelShipment, payShipmentWithTestPayment } from '../../api/services/shipmentService'

/** What the last action said, shown at the top of the page. */
export interface ShipmentMessage {
  text: string
  isError: boolean
}

/**
 * The parcel buttons on My shipments and a parcel's page:
 * - **Pay now** once weighed (TEMPORARY test payment: no money moves, until a real payment provider is connected);
 * - **Cancel** (asks first) before the parcel leaves; a paid one is refunded.
 * Both reload the parcels afterwards, so the page shows the API's view.
 */
export function useShipmentActions() {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null)
  const [message, setMessage] = useState<ShipmentMessage | null>(null)

  const run = async (key: string, action: () => Promise<ShipmentMessage>) => {
    setBusy(key)
    setMessage(null)
    try {
      setMessage(await action())
      await queryClient.invalidateQueries({ queryKey: ['shipments'] })
    } finally {
      setBusy(null)
    }
  }

  const pay = (trackingNumber: string) => run(`pay:${trackingNumber}`, async () => {
    const result = await payShipmentWithTestPayment(trackingNumber)
    if (result.ok) {
      return { isError: false, text: `${trackingNumber} is paid with a TEST payment (no money was taken). ` +
        "It'll be on its way soon." }
    }
    return {
      isError: true,
      text: result.error.status === 404 && result.error.code !== 'Shipment.NotFound'
        ? "Payments aren't switched on yet. Your parcel stays at the hub until it's paid."
        : result.error.displayMessage,
    }
  })

  const cancel = (trackingNumber: string, wasPaid: boolean) => run(`cancel:${trackingNumber}`, async () => {
    setConfirmCancel(null)
    const result = await cancelShipment(trackingNumber)
    return result.ok
      ? { isError: false, text: `${trackingNumber} is cancelled.${wasPaid ? ' Your payment will be refunded.' : ''}` }
      : { isError: true, text: result.error.displayMessage }
  })

  return { busy, message, confirmCancel, setConfirmCancel, pay, cancel }
}
