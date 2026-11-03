/**
 * Does a message look like it has contact or payment details? The same check as the API's
 * Phloem.Domain/Rules/OffPlatformHints (keep the two in step). Used to show a gentle warning: nothing is blocked.
 */

/** Phloem's own order and tracking numbers ("PH-261016-482193" is not a phone number). */
const PHLOEM_NUMBER = /\bPHS?-\d{6}-\d{6}\b/gi
/** 8+ digits, allowing spaces, dashes, dots, brackets and a leading +. */
const PHONE = /\+?\d[\d\s\-().]{6,}\d/
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/
const WORDS = /\b(whats\s?app|telegram|bank\s+transfer|account\s+(number|no)|acct\s*no|sort\s+code|iban|momo|mobile\s+money|cash\s?app|pay\s+(me\s+)?(directly|outside|cash)|send\s+(the\s+)?money\s+to|my\s+number)\b/i

/** True when the text looks like it has a phone number, email or payment details. */
export function hasContactDetails(text: string | null | undefined): boolean {
  if (!text || !text.trim()) return false
  const plain = text.replace(PHLOEM_NUMBER, ' ')
  return PHONE.test(plain) || EMAIL.test(plain) || WORDS.test(plain)
}
