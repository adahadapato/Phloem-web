import { HomeCooks } from './HomeCooks'
import { HomeCravings } from './HomeCravings'
import { HomeDishes } from './HomeDishes'
import { HomeForYou } from './HomeForYou'
import { HomeHero } from './HomeHero'
import { HomeHowItWorks } from './HomeHowItWorks'
import { HomeSell } from './HomeSell'
import { HomeSendHome } from './HomeSendHome'
import { usePageSeo } from '../../components/layout/usePageSeo'
import { CustomerReviews } from '../../components/reviews/CustomerReviews'

/**
 * Home, laid out like a restaurant's landing page (not like the app): the big food photo with the headline and
 * search, "What are you craving?", suggestions (Order again / You might like, or Popular in … when signed out),
 * the top-rated dishes, the cooks, how it works, "What our customers say" (once there are 3 public reviews), the parcel service and the
 * invitation to sell. Dishes and shops come from the API for the country picked at the top; the colours are the
 * app's (tokens.css).
 */
export default function HomePage() {
  usePageSeo('/')
  return (
    <>
      <HomeHero />
      <HomeCravings />
      <HomeForYou />
      <HomeDishes />
      <HomeCooks />
      <HomeHowItWorks />
      <CustomerReviews eyebrow="Reviews" title="What our customers say" />
      <HomeSendHome />
      <HomeSell />
    </>
  )
}
