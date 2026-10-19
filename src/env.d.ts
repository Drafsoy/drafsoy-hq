/// <reference types="vite/client" />
import type { DrafsoyApi } from '../electron/preload'

declare global {
  interface Window {
    drafsoy: DrafsoyApi
  }
}

interface ImportMetaEnv {
  readonly RENDERER_VITE_SUPABASE_URL: string
  readonly RENDERER_VITE_SUPABASE_ANON_KEY: string
}
