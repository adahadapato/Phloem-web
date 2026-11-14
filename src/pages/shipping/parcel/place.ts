/** The recipient's place as typed / picked. */
export interface PlaceDraft {
  regionId: string | null
  regionName: string
  districtId: string | null
  /** Town or area, e.g. "Lekki" (also "City or town" where there's no list). */
  town: string
  /** Set when a known town was picked from the suggestions. */
  townId: string | null
  /** Postcode (UK) / region text where there's no list. */
  postcode: string
}

export const emptyPlace: PlaceDraft = { regionId: null, regionName: '', districtId: null, town: '', townId: null, postcode: '' }
