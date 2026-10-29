import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { config as cargarEnv } from 'dotenv'

// Las llaves viven en el archivo .env y solo las lee "el cerebro" (proceso principal).
// En desarrollo: la carpeta del proyecto. En la app instalada: la carpeta de datos del usuario.
const candidatos = [join(process.cwd(), '.env'), join(app.getPath('userData'), '.env')]
const archivo = candidatos.find((r) => existsSync(r))
if (archivo) cargarEnv({ path: archivo, quiet: true })

export const CONFIG = {
  supabaseUrl: process.env.RENDERER_VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.RENDERER_VITE_SUPABASE_ANON_KEY ?? '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  // Google Cloud -> Credenciales -> ID de cliente OAuth de tipo "App de escritorio"
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  // Netlify -> User settings -> Applications -> Personal access tokens
  netlifyToken: process.env.NETLIFY_AUTH_TOKEN ?? ''
}
