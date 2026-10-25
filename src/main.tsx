import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// Headline font (DM Serif Display, SIL Open Font Licence), served with the site: no call to Google
import '@fontsource/dm-serif-display/latin-400.css'
import '@fontsource/dm-serif-display/latin-400-italic.css'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
