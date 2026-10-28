/**
 * Couriers (and sellers delivering their own orders): "My deliveries" and "Delivered" with a photo of where it was
 * left (/api/deliveries). Same as the app's DeliveryService.
 */
import type { ApiResult } from '../apiError'
import { get, upload } from '../client'
import type { DeliveryJobDto } from '../contracts/dtos'
import type { DeliveryKind, HandoverMethod } from '../contracts/enums'

/** GET /api/deliveries: still to deliver (oldest first), or done = delivered in the last 7 days. */
export const getMyDeliveries = (done: boolean, signal?: AbortSignal): Promise<ApiResult<DeliveryJobDto[]>> =>
  get<DeliveryJobDto[]>(`api/deliveries?done=${done}`, signal)

/** What the courier entered on "Delivered". */
export interface DeliveredForm {
  photo: File
  handover: HandoverMethod
  /** Who took it (required for a neighbour). */
  receivedBy?: string
  note?: string
}

/**
 * POST …/delivered (multipart): a food order (the shop is paid, the customer emailed) or a parcel (the sender is
 * emailed). The photo is shrunk and its location data removed on the server.
 */
export function markDelivered(kind: DeliveryKind, reference: string, form: DeliveredForm): Promise<ApiResult<void>> {
  const folder = kind === 'Parcel' ? 'parcels' : 'orders'
  const fields: Record<string, string> = { handover: form.handover }
  if (form.receivedBy?.trim()) fields.receivedBy = form.receivedBy.trim()
  if (form.note?.trim()) fields.note = form.note.trim()
  return upload<void>('POST', `api/deliveries/${folder}/${encodeURIComponent(reference)}/delivered`, 'photo',
                      form.photo, fields)
}
