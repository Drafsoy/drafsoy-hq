import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/luckiest-guy'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/900.css'
import './estilos.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
