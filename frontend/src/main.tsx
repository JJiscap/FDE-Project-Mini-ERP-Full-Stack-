import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from '@/App'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'
import { installChunkReload } from '@/lib/chunk-errors'

installChunkReload()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
