import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { registry } from './modules'
import './styles/tokens.css'
import './styles/base.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App registry={registry} />
  </StrictMode>,
)
