/**
 * The API's enums. The API sends and accepts them as NAMES ("Ghana", not 1), so they are string unions here
 * (TypeScript `enum`s aren't used: the project builds with `erasableSyntaxOnly`).
 * Keep in step with the API (Phloem.Domain/Enums) and the app (Services/Api/Contracts/Enums).
 */

/** A country Phloem works in. Names, flags and currencies come from GET /api/countries. */
export type Country = 'Ghana' | 'Nigeria' | 'UnitedKingdom'

/** A currency (each country has one). */
export type Currency = 'GHS' | 'NGN' | 'GBP'
