// El despertador de la recepcionista: Supabase (pg_cron, ver supabase/migraciones/006_recordatorios.sql)
// llama aquí cada minuto. Manda por Telegram los recordatorios que ya tocan y, a la hora que Rafa
// eligió, el resumen diario de agenda. Funciona con el PC apagado. No usa IA (no gasta).
//
// Secretos que necesita (Supabase -> Edge Functions -> Secrets):
//   TELEGRAM_BOT_TOKEN, RECORDATORIOS_SECRETO (el mismo que aura_recordatorios_secreto del Vault), ZONA_HORARIA (opcional)

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'

const ZONA = Deno.env.get('ZONA_HORARIA') || 'America/Lima'
const BOT = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
const ESTADOS_ABIERTOS = ['pendiente', 'en_progreso', 'te_necesita', 'esperando_aprobacion']
const VENTANA_RESUMEN_MIN = 30 // si el despertador se salta la hora exacta, aún lo manda dentro de esta media hora

Deno.serve(async (req) => {
  const secreto = Deno.env.get('RECORDATORIOS_SECRETO')
  if (!secreto || req.headers.get('x-aura-secreto') !== secreto) return new Response('no', { status: 401 })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  const [avisos, resumenes] = await Promise.all([
    mandarRecordatorios(db).catch((e) => (console.error('recordatorios', e), -1)),
    mandarResumenes(db).catch((e) => (console.error('resumenes', e), -1))
  ])
  return Response.json({ avisos, resumenes })
})

// ---------- Recordatorios vencidos ----------
async function mandarRecordatorios(db: SupabaseClient): Promise<number> {
  const ahora = new Date().toISOString()
  // Se marcan como enviados ANTES de mandarlos: si el despertador se solapa, nadie los manda dos veces
  const { data, error } = await db
    .from('recordatorios')
    .update({ enviado_en: ahora })
    .is('enviado_en', null)
    .lte('cuando', ahora)
    .select('id, dueno, chat_id, texto, cuando')
  if (error) throw error
  if (!data?.length) return 0

  // Solo a chats de la lista blanca de ese dueño (chat_id vacío = su primer Telegram)
  const { data: chats } = await db.from('telegram_chats').select('chat_id, dueno').in('dueno', [...new Set(data.map((r) => r.dueno))])
  let enviados = 0
  for (const r of data) {
    const suyos = (chats ?? []).filter((c) => c.dueno === r.dueno).map((c) => Number(c.chat_id))
    const destino = r.chat_id && suyos.includes(Number(r.chat_id)) ? Number(r.chat_id) : suyos[0]
    if (!destino) {
      console.error(`Recordatorio ${r.id}: el dueño no tiene Telegram autorizado`)
      continue
    }
    const contenido = `⏰ Recordatorio: ${r.texto}`
    if (await enviarTelegram(destino, contenido)) {
      enviados++
      await db.from('mensajes').insert({ dueno: r.dueno, canal: 'recepcion', rol: 'asistente', contenido })
    } else if (Date.now() - new Date(r.cuando).getTime() < 60 * 60_000) {
      // Telegram falló: se reintenta el minuto siguiente (durante una hora como mucho)
      await db.from('recordatorios').update({ enviado_en: null }).eq('id', r.id)
    }
  }
  return enviados
}

// ---------- Resumen diario de agenda ----------
async function mandarResumenes(db: SupabaseClient): Promise<number> {
  const ahora = new Date()
  const hoy = ahora.toLocaleDateString('en-CA', { timeZone: ZONA })
  const [h, m] = ahora.toLocaleTimeString('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' }).split(':').map(Number)
  const minutoDelDia = h * 60 + m

  const { data: chats, error } = await db.from('telegram_chats').select('chat_id, dueno, resumen_diario, resumen_enviado_el').not('resumen_diario', 'is', null)
  if (error) throw error
  let enviados = 0
  for (const c of chats ?? []) {
    const [hh, mm] = String(c.resumen_diario).split(':').map(Number)
    const pasados = minutoDelDia - (hh * 60 + mm)
    if (pasados < 0 || pasados > VENTANA_RESUMEN_MIN || c.resumen_enviado_el === hoy) continue
    // Reservar el de hoy (si dos despertadores coinciden, solo uno lo consigue)
    const { data: reservado } = await db
      .from('telegram_chats')
      .update({ resumen_enviado_el: hoy })
      .eq('chat_id', c.chat_id)
      .or(`resumen_enviado_el.is.null,resumen_enviado_el.neq.${hoy}`)
      .select('chat_id')
    if (!reservado?.length) continue
    const contenido = await armarResumen(db, c.dueno, hoy)
    if (await enviarTelegram(Number(c.chat_id), contenido)) {
      enviados++
      await db.from('mensajes').insert({ dueno: c.dueno, canal: 'recepcion', rol: 'asistente', contenido })
    }
  }
  return enviados
}

async function armarResumen(db: SupabaseClient, dueno: string, hoy: string): Promise<string> {
  const finDeHoy = new Date(Date.now() + 24 * 60 * 60_000).toISOString()
  const [{ data: tareas }, { data: clientes }, { data: recordatorios }] = await Promise.all([
    db.from('tareas').select('titulo, prioridad, cliente_id, fecha_limite').eq('dueno', dueno).in('estado', ESTADOS_ABIERTOS),
    db.from('clientes').select('id, nombre').eq('dueno', dueno),
    db.from('recordatorios').select('texto, cuando').eq('dueno', dueno).is('enviado_en', null).lte('cuando', finDeHoy).order('cuando')
  ])
  const cliente = (id: string | null) => (clientes ?? []).find((c) => c.id === id)?.nombre ?? 'sin cliente'
  const orden: Record<string, number> = { urgente: 0, alta: 1, media: 2, baja: 3 }
  const abiertas = (tareas ?? []).sort((a, b) => (orden[a.prioridad] ?? 9) - (orden[b.prioridad] ?? 9))
  const vencidas = abiertas.filter((t) => t.fecha_limite && t.fecha_limite < hoy)
  const deHoy = abiertas.filter((t) => t.fecha_limite === hoy)
  const urgentes = abiertas.filter((t) => (!t.fecha_limite || t.fecha_limite > hoy) && t.prioridad === 'urgente')
  const linea = (t: { titulo: string; prioridad: string; cliente_id: string | null }) => `• ${t.titulo} (${cliente(t.cliente_id)}, ${t.prioridad})`
  const hora = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' })

  const partes = [`☀️ Hola, Rafa. Tu agenda de hoy:`]
  if (vencidas.length) partes.push(`\nAtrasadas (${vencidas.length}):\n${vencidas.slice(0, 10).map(linea).join('\n')}`)
  if (deHoy.length) partes.push(`\nVencen hoy (${deHoy.length}):\n${deHoy.slice(0, 10).map(linea).join('\n')}`)
  if (urgentes.length) partes.push(`\nUrgentes sin vencer (${urgentes.length}):\n${urgentes.slice(0, 10).map(linea).join('\n')}`)
  if (recordatorios?.length) partes.push(`\nRecordatorios próximos:\n${recordatorios.slice(0, 10).map((r) => `• ${hora(r.cuando)} ${r.texto}`).join('\n')}`)
  if (partes.length === 1) partes.push('\nNada vence hoy ni hay urgencias. 🎉')
  partes.push(`\nEn total hay ${abiertas.length} tareas abiertas. Escríbeme "¿qué hay hoy?" para el detalle.`)
  return partes.join('\n')
}

async function enviarTelegram(chatId: number, texto: string): Promise<boolean> {
  if (!BOT) {
    console.error('Falta el secreto TELEGRAM_BOT_TOKEN')
    return false
  }
  const r = await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto.slice(0, 4000) })
  }).catch((e) => e as Error)
  if (r instanceof Error || !r.ok) {
    console.error('Telegram no aceptó el mensaje', r instanceof Error ? r.message : await r.text())
    return false
  }
  return true
}
