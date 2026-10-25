import { HomeCooks } from './HomeCooks'
import { HomeCravings } from './HomeCravings'
import { HomeDishes } from './HomeDishes'
import { HomeHero } from './HomeHero'
import { HomeHowItWorks } from './HomeHowItWorks'
import { HomeSell } from './HomeSell'
import { HomeSendHome } from './HomeSendHome'

/**
 * Home, laid out like a restaurant's landing page (not like the app): the big food photo with the headline and
 * search, "What are you craving?", the top-rated dishes, the cooks, how it works, the parcel service and the
 * invitation to sell. Dishes and shops come from the API for the country picked at the top; the colours are the
 * app's (tokens.css).
 */
export default function HomePage() {
  return (
    <>
      <HomeHero />
      <HomeCravings />
      <HomeDishes />
      <HomeCooks />
      <HomeHowItWorks />
      <HomeSendHome />
      <HomeSell />
    </>
  )
}
