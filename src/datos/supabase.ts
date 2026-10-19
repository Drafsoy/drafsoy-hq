import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.RENDERER_VITE_SUPABASE_URL
const llaveAnon = import.meta.env.RENDERER_VITE_SUPABASE_ANON_KEY

export const supabaseConfigurado = Boolean(url && llaveAnon)

// Si faltan las llaves, la app muestra una pantalla de ayuda en lugar de romperse.
export const supabase = createClient(url || 'http://sin-configurar.local', llaveAnon || 'sin-configurar', {
  auth: { persistSession: true, autoRefreshToken: true }
})
