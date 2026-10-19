import Anthropic from '@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { CONFIG } from '../config'
import { costeUsd, gastoDelMes, registrarGasto } from './gastos'

// Piezas compartidas por todos los agentes que trabajan en "el cerebro".

export interface AgenteDb {
  id: string
  nombre: string
  rol: string
  modelo: string
  instrucciones: string
  herramientas: string[]
  tope_gasto_usd: number
  es_recepcionista: boolean
  es_supervisor: boolean
  estado: string
}

export const COLUMNAS_AGENTE = 'id, nombre, rol, modelo, instrucciones, herramientas, tope_gasto_usd, es_recepcionista, es_supervisor, estado'

export const ACCIONES_EXTERNAS = ['enviar', 'publicar', 'pausar', 'cambiar_presupuesto', 'subir_archivo', 'agendar_reunion'] as const

// Qué datos necesita cada acción con Google (se explica a los agentes y se comprueba al proponer y al ejecutar)
export const DATOS_ACCIONES =
  'enviar (envía un correo desde el Gmail de Rafa): detalle.para (correos separados por comas), detalle.asunto, detalle.cuerpo (texto completo del correo, listo para enviar, con saludo y firma "Rafa"); opcional detalle.cc. ' +
  'subir_archivo (crea un Google Doc en la carpeta de Drive del cliente con el entregable): detalle.titulo_documento; opcional detalle.carpeta (nombre de una subcarpeta dentro de la del cliente, solo si Rafa la pide). ' +
  'agendar_reunion (crea un evento en Google Calendar e invita por correo): detalle.titulo, detalle.fecha (AAAA-MM-DD), detalle.hora (HH:MM, 24 h), ' +
  'detalle.duracion_minutos, detalle.invitados (correos separados por comas), detalle.descripcion; opcional detalle.zona_horaria (p. ej. America/Lima) y detalle.videollamada ("si"/"no").'

const CORREO = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/
export const correosDe = (texto: unknown) =>
  String(texto ?? '')
    .split(/[,;\s]+/)
    .map((c) => c.trim())
    .filter(Boolean)

// Devuelve un error legible si a la propuesta le faltan datos para poder ejecutarse
export function problemaEnDetalle(tipo: string, detalle: Record<string, unknown>): string | null {
  if (tipo === 'enviar') {
    const para = correosDe(detalle.para)
    if (!para.length) return 'detalle.para necesita al menos un correo.'
    const malos = [...para, ...correosDe(detalle.cc)].filter((c) => !CORREO.test(c))
    if (malos.length) return `Correos no válidos: ${malos.join(', ')}`
    if (!String(detalle.asunto ?? '').trim()) return 'Falta detalle.asunto del correo.'
    if (String(detalle.cuerpo ?? '').trim().length < 10) return 'Falta detalle.cuerpo con el texto completo del correo.'
  }
  if (tipo === 'agendar_reunion') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(detalle.fecha ?? ''))) return 'detalle.fecha debe ser AAAA-MM-DD.'
    if (!/^\d{1,2}:\d{2}$/.test(String(detalle.hora ?? ''))) return 'detalle.hora debe ser HH:MM (24 h).'
    if (String(detalle.fecha) < new Date().toLocaleDateString('sv')) return 'La fecha de la reunión ya pasó.'
    const invitados = correosDe(detalle.invitados)
    if (!invitados.length) return 'detalle.invitados necesita al menos un correo.'
    const malos = invitados.filter((c) => !CORREO.test(c))
    if (malos.length) return `Correos no válidos: ${malos.join(', ')}`
    if (!String(detalle.titulo ?? '').trim()) return 'Falta detalle.titulo de la reunión.'
  }
  return null
}

// Supabase con la sesión de Rafa: las reglas de seguridad se aplican igual que en la pantalla
export function crearDb(token: string): SupabaseClient {
  return createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

export function crearAnthropic(): Anthropic {
  if (!CONFIG.anthropicApiKey) throw new Error('Falta ANTHROPIC_API_KEY en el archivo .env')
  return new Anthropic({ apiKey: CONFIG.anthropicApiKey })
}

// Modelos con respaldo automático en el servidor si el modelo rechaza una petición
const CON_RESPALDO = new Set(['claude-opus-5-5', 'claude-sonnet-5-5'])
export const ADMITE_BUSQUEDA_WEB = new Set(['claude-opus-5-5', 'claude-sonnet-5-5'])

export function llamarModelo(anthropic: Anthropic, params: Anthropic.Beta.MessageCreateParamsNonStreaming) {
  if (CON_RESPALDO.has(params.model)) {
    return anthropic.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
  }
  return anthropic.beta.messages.create(params)
}

// Devuelve un aviso si el agente o la agencia ya llegaron a su tope de gasto del mes
export async function superaTope(db: SupabaseClient, agente: AgenteDb): Promise<string | null> {
  const [{ data: ajustes }, gasto] = await Promise.all([db.from('ajustes').select('tope_mensual_usd').maybeSingle(), gastoDelMes(db, agente.id)])
  const topeTotal = Number(ajustes?.tope_mensual_usd ?? 50)
  if (gasto.total >= topeTotal) return `Se alcanzó el tope de gasto de IA del mes ($${topeTotal.toFixed(2)}).`
  if (gasto.delAgente >= Number(agente.tope_gasto_usd)) return `${agente.nombre} alcanzó su tope de gasto del mes ($${Number(agente.tope_gasto_usd).toFixed(2)}).`
  return null
}

// Acumula tokens y coste de varias llamadas y los registra al final
export class Contador {
  entrada = 0
  salida = 0
  coste = 0
  constructor(private modelo: string) {}
  sumar(uso: Anthropic.Beta.BetaUsage) {
    this.entrada += uso.input_tokens
    this.salida += uso.output_tokens
    this.coste += costeUsd(this.modelo, {
      input_tokens: uso.input_tokens,
      output_tokens: uso.output_tokens,
      cache_creation_input_tokens: uso.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: uso.cache_read_input_tokens ?? 0
    } as Anthropic.Usage)
  }
  async registrar(db: SupabaseClient, agenteId: string, tareaId: string | null) {
    if (this.entrada || this.salida) await registrarGasto(db, { agenteId, tareaId, modelo: this.modelo, entrada: this.entrada, salida: this.salida, coste: this.coste })
  }
}

export const textoDe = (contenido: Anthropic.Beta.BetaContentBlock[]) =>
  contenido
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()

export async function memoriaDelCliente(db: SupabaseClient, clienteId: string | null) {
  if (!clienteId) return { cliente: null, memoria: [] as { clave: string; contenido: string }[] }
  const [{ data: cliente }, { data: memoria }] = await Promise.all([
    db.from('clientes').select('id, nombre, descripcion').eq('id', clienteId).maybeSingle(),
    db.from('memoria_cliente').select('clave, contenido').eq('cliente_id', clienteId)
  ])
  return { cliente: cliente as { id: string; nombre: string; descripcion: string | null } | null, memoria: (memoria ?? []) as { clave: string; contenido: string }[] }
}

export const mensajeError = (e: unknown) =>
  e instanceof Anthropic.AuthenticationError
    ? 'La llave de Anthropic no es válida.'
    : e instanceof Anthropic.RateLimitError
      ? 'Límite de uso de la IA alcanzado; reintenta en un minuto.'
      : e instanceof Anthropic.APIError
        ? `Error de la IA (${e.status}): ${e.message}`
        : e instanceof Error
          ? e.message
          : String(e)
