import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { app, safeStorage, shell } from 'electron'
import { CONFIG } from './config'

// CONEXIÓN CON GOOGLE (Drive, Calendar y Gmail). Vive solo en "el cerebro":
// la pantalla nunca ve los tokens; solo pide "conectar", "desconectar" o "¿estoy conectado?".
// Los tokens se guardan cifrados con el sistema operativo (en Windows, ligado a tu usuario).

const PERMISOS = [
  'openid',
  'email',
  // Solo los archivos y carpetas que crea Drafsoy HQ (no ve el resto de tu Drive)
  'https://www.googleapis.com/auth/drive.file',
  // Crear eventos en tu calendario
  'https://www.googleapis.com/auth/calendar.events',
  // Enviar correos desde tu Gmail (no puede leer tu bandeja)
  'https://www.googleapis.com/auth/gmail.send'
]
const PERMISO_GMAIL = 'https://www.googleapis.com/auth/gmail.send'
const ESPERA_MAXIMA_MS = 5 * 60 * 1000

interface Guardado {
  refreshToken: string
  correo: string
  permisos: string
}

let acceso: { token: string; caduca: number } | null = null
const archivoTokens = () => join(app.getPath('userData'), 'google-tokens.bin')

function leerGuardado(): Guardado | null {
  const ruta = archivoTokens()
  if (!existsSync(ruta) || !safeStorage.isEncryptionAvailable()) return null
  try {
    return JSON.parse(safeStorage.decryptString(readFileSync(ruta))) as Guardado
  } catch {
    return null
  }
}

function guardar(datos: Guardado) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Este equipo no permite guardar los permisos de Google de forma segura.')
  writeFileSync(archivoTokens(), safeStorage.encryptString(JSON.stringify(datos)))
}

export function estadoGoogle() {
  const g = leerGuardado()
  return {
    configurado: Boolean(CONFIG.googleClientId && CONFIG.googleClientSecret),
    conectado: Boolean(g),
    correo: g?.correo ?? null,
    // Conexiones hechas antes de añadir Gmail: hay que volver a conectar para dar ese permiso
    faltaGmail: Boolean(g) && !g!.permisos.includes(PERMISO_GMAIL)
  }
}

export const googleConectado = () => Boolean(leerGuardado())
export const gmailPermitido = () => Boolean(leerGuardado()?.permisos.includes(PERMISO_GMAIL))

const base64url = (b: Buffer) => b.toString('base64url')

// Abre tu navegador con la pantalla de permisos de Google y espera la respuesta en este equipo
export async function conectarGoogle(): Promise<{ correo: string }> {
  if (!CONFIG.googleClientId || !CONFIG.googleClientSecret) throw new Error('Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el archivo .env.')

  const verificador = base64url(randomBytes(48))
  const reto = base64url(createHash('sha256').update(verificador).digest())
  const estado = base64url(randomBytes(16))

  const servidor = createServer()
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok))
  const redirect = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`

  try {
    const codigo = new Promise<string>((ok, mal) => {
      const reloj = setTimeout(() => mal(new Error('Pasaron 5 minutos sin respuesta de Google. Vuelve a intentarlo.')), ESPERA_MAXIMA_MS)
      servidor.on('request', (req, res) => {
        const url = new URL(req.url ?? '/', redirect)
        const error = url.searchParams.get('error')
        const recibido = url.searchParams.get('code')
        if (!error && !recibido) {
          res.writeHead(404).end()
          return
        }
        const valido = url.searchParams.get('state') === estado
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(
          `<html><body style="font-family:sans-serif;background:#1b1f4b;color:#fff;text-align:center;padding-top:80px">` +
            `<h1>${!error && valido ? '✅ Google conectado' : '❌ No se conectó'}</h1><p>Ya puedes cerrar esta pestaña y volver a Drafsoy HQ.</p></body></html>`
        )
        clearTimeout(reloj)
        if (error) mal(new Error(error === 'access_denied' ? 'Cancelaste el permiso en Google.' : `Google respondió: ${error}`))
        else if (!valido) mal(new Error('La respuesta de Google no coincide con esta conexión. Vuelve a intentarlo.'))
        else ok(recibido!)
      })
    })

    const params = new URLSearchParams({
      client_id: CONFIG.googleClientId,
      redirect_uri: redirect,
      response_type: 'code',
      scope: PERMISOS.join(' '),
      code_challenge: reto,
      code_challenge_method: 'S256',
      state: estado,
      access_type: 'offline',
      prompt: 'consent'
    })
    await shell.openExternal(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)

    const tokens = await pedirToken({
      code: await codigo,
      code_verifier: verificador,
      redirect_uri: redirect,
      grant_type: 'authorization_code'
    })
    if (!tokens.refresh_token) throw new Error('Google no devolvió un permiso duradero. Vuelve a intentarlo.')
    const concedidos = String(tokens.scope ?? '')
    const faltan = PERMISOS.filter((p) => p.startsWith('https://') && !concedidos.includes(p))
    if (faltan.length) throw new Error('Debes marcar todas las casillas (Drive, Calendar y Gmail) en la pantalla de permisos.')

    acceso = { token: tokens.access_token, caduca: Date.now() + (tokens.expires_in - 60) * 1000 }
    const yo = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } }).then((r) => r.json())
    const correo = String(yo.email ?? '')
    guardar({ refreshToken: tokens.refresh_token, correo, permisos: concedidos })
    return { correo }
  } finally {
    servidor.close()
  }
}

export async function desconectarGoogle() {
  const g = leerGuardado()
  acceso = null
  if (existsSync(archivoTokens())) rmSync(archivoTokens())
  // Avisar a Google para que anule el permiso (si falla, igualmente ya lo olvidamos aquí)
  if (g) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(g.refreshToken)}`, { method: 'POST' }).catch(() => {})
}

async function pedirToken(campos: Record<string, string>) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CONFIG.googleClientId, client_secret: CONFIG.googleClientSecret, ...campos })
  })
  const datos = await r.json()
  if (!r.ok) {
    if (datos.error === 'invalid_grant') throw new Error('El permiso de Google caducó o se retiró. Vuelve a conectar Google en Ajustes.')
    throw new Error(`Google rechazó la conexión: ${datos.error_description ?? datos.error ?? r.status}`)
  }
  return datos as { access_token: string; expires_in: number; refresh_token?: string; scope?: string }
}

async function tokenDeAcceso(): Promise<string> {
  if (acceso && acceso.caduca > Date.now()) return acceso.token
  const g = leerGuardado()
  if (!g) throw new Error('Google no está conectado. Conéctalo en Ajustes.')
  const t = await pedirToken({ refresh_token: g.refreshToken, grant_type: 'refresh_token' })
  acceso = { token: t.access_token, caduca: Date.now() + (t.expires_in - 60) * 1000 }
  return acceso.token
}

async function llamarGoogle(url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${await tokenDeAcceso()}` } })
  const datos = r.status === 204 ? {} : await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Google (${r.status}): ${datos?.error?.message ?? r.statusText}`)
  return datos
}

// ---------- Drive ----------

const CARPETA = 'application/vnd.google-apps.folder'

// Busca (por una marca interna, no por nombre) o crea una carpeta de Drafsoy HQ
async function carpeta(nombre: string, marca: string, padre?: string): Promise<string> {
  const q = `mimeType='${CARPETA}' and trashed=false and appProperties has { key='drafsoy' and value='${marca}' }`
  const encontradas = await llamarGoogle(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`)
  if (encontradas.files?.[0]?.id) return encontradas.files[0].id
  const nueva = await llamarGoogle('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nombre, mimeType: CARPETA, parents: padre ? [padre] : undefined, appProperties: { drafsoy: marca } })
  })
  return nueva.id
}

// Crea un Google Doc con el texto en "Drafsoy HQ / <cliente>" (o en una subcarpeta con nombre propio dentro)
export async function crearDocumento(opciones: { titulo: string; contenido: string; clienteId: string | null; clienteNombre: string; subcarpeta?: string }) {
  const raiz = await carpeta('Drafsoy HQ', 'raiz')
  const marcaCliente = `cliente:${opciones.clienteId ?? 'general'}`
  let destino = await carpeta(opciones.clienteNombre, marcaCliente, raiz)
  let ruta = `Drafsoy HQ / ${opciones.clienteNombre}`
  const sub = (opciones.subcarpeta ?? '').replace(/['\\]/g, '').trim().slice(0, 60)
  if (sub) {
    destino = await carpeta(sub, `${marcaCliente}/${sub.toLowerCase()}`, destino)
    ruta += ` / ${sub}`
  }

  const texto = opciones.contenido.replace(/\r\n/g, '\n').replace(/([^\n])\n(?=[^\n])/g, '$1  \n')
  const subir = async (tipo: string) => {
    const limite = `drafsoy-${randomUUID()}`
    const metadatos = { name: opciones.titulo, mimeType: 'application/vnd.google-apps.document', parents: [destino] }
    const cuerpo =
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadatos)}\r\n` +
      `--${limite}\r\nContent-Type: ${tipo}; charset=UTF-8\r\n\r\n${texto}\r\n--${limite}--`
    return llamarGoogle('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
      body: cuerpo
    })
  }
  // Markdown conserva títulos, negritas y listas; si Google no lo acepta, va como texto simple
  const doc = await subir('text/markdown').catch(() => subir('text/plain'))
  return { id: doc.id as string, nombre: doc.name as string, enlace: doc.webViewLink as string, carpeta: ruta }
}

// ---------- Calendar ----------

// Suma minutos a una fecha-hora "de reloj" (sin zona) y la devuelve en el mismo formato
function sumarMinutos(fecha: string, hora: string, minutos: number) {
  const [a, m, d] = fecha.split('-').map(Number)
  const [h, min] = hora.split(':').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d, h, min + minutos))
  return t.toISOString().slice(0, 19)
}

export async function crearEvento(e: { titulo: string; descripcion: string; fecha: string; hora: string; duracionMin: number; invitados: string[]; zona: string; videollamada: boolean }) {
  const params = new URLSearchParams({ sendUpdates: 'all', conferenceDataVersion: e.videollamada ? '1' : '0' })
  const evento = await llamarGoogle(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: e.titulo,
      description: e.descripcion,
      start: { dateTime: sumarMinutos(e.fecha, e.hora, 0), timeZone: e.zona },
      end: { dateTime: sumarMinutos(e.fecha, e.hora, e.duracionMin), timeZone: e.zona },
      attendees: e.invitados.map((email) => ({ email })),
      conferenceData: e.videollamada ? { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } } : undefined
    })
  })
  return { id: evento.id as string, enlace: evento.htmlLink as string, meet: (evento.hangoutLink as string | undefined) ?? null }
}

// Lee los eventos del calendario entre dos días (incluidos), en la hora de esta PC. Solo lectura.
export async function listarEventos(desde: string, hasta: string) {
  const inicio = new Date(`${desde}T00:00:00`)
  const fin = new Date(`${hasta}T23:59:59`)
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) throw new Error('Fechas no válidas (usa AAAA-MM-DD).')
  const params = new URLSearchParams({
    timeMin: inicio.toISOString(),
    timeMax: fin.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '30'
  })
  const datos = await llamarGoogle(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`)
  const hora = (v?: { dateTime?: string; date?: string }) =>
    v?.dateTime ? new Date(v.dateTime).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : v?.date ? `${v.date} (todo el día)` : ''
  return ((datos.items ?? []) as Record<string, any>[]).map((e) => ({
    titulo: e.summary ?? '(sin título)',
    empieza: hora(e.start),
    termina: hora(e.end),
    meet: e.hangoutLink ?? e.conferenceData?.entryPoints?.find((p: { entryPointType?: string }) => p.entryPointType === 'video')?.uri ?? null,
    enlace: e.htmlLink ?? null,
    lugar: e.location ?? null,
    invitados: Array.isArray(e.attendees) ? e.attendees.map((a: { email?: string }) => a.email).filter(Boolean).slice(0, 10) : []
  }))
}

// ---------- Gmail ----------

// Asunto con acentos y emojis: se codifica para que llegue bien a cualquier programa de correo
const cabeceraUtf8 = (texto: string) => `=?UTF-8?B?${Buffer.from(texto.replace(/[\r\n]+/g, ' '), 'utf8').toString('base64')}?=`

export async function enviarCorreo(c: { para: string[]; cc: string[]; asunto: string; cuerpo: string }) {
  const cuerpo64 = Buffer.from(c.cuerpo.replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n')
  const mensaje = [
    `To: ${c.para.join(', ')}`,
    ...(c.cc.length ? [`Cc: ${c.cc.join(', ')}`] : []),
    `Subject: ${cabeceraUtf8(c.asunto)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    cuerpo64
  ].join('\r\n')
  const enviado = await llamarGoogle('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: Buffer.from(mensaje, 'utf8').toString('base64url') })
  })
  return { id: enviado.id as string, enlace: `https://mail.google.com/mail/u/0/#sent/${enviado.threadId ?? enviado.id}` }
}
