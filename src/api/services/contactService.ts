/**
 * Contact us: GET /api/contact (the details on the page) and POST /api/contact/messages (the form).
 * Same as the app's ContactService. Anyone can send a message; when signed in it's linked to the account.
 */
import type { ApiResult } from '../apiError'
import { get, post } from '../client'
import type { SendContactMessageCommand } from '../contracts/commands'
import type { ContactDetailsDto } from '../contracts/dtos'

/** The support email, phone, WhatsApp, address, opening hours and reply time (null = not shown). */
export const getContactDetails = (signal?: AbortSignal): Promise<ApiResult<ContactDetailsDto>> =>
  get<ContactDetailsDto>('api/contact', signal)

/** Sends the form: saved for the team, emailed to them, and a confirmation emailed to the sender. */
export const sendContactMessage = (command: SendContactMessageCommand) => post('api/contact/messages', command)
