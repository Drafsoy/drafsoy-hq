import type { SupabaseClient } from '@supabase/supabase-js'
import { correosDe, crearDb, problemaEnDetalle } from './comun'
import { crearDocumento, crearEvento, enviarCorreo, gmailPermitido, googleConectado } from '../google'
import { publicarEnNetlify } from '../netlify'

// El ejecutor: lo ÚNICO que puede tocar el mundo exterior, y solo después de que Rafa apruebe.
// Gmail (enviar), Google Drive (subir_archivo), Google Calendar (agendar_reunion) y publicar en Netlify son reales; el resto sigue simulado.

const CON_GOOGLE = ['enviar', 'subir_archivo', 'agendar_reunion']

interface AprobacionDb {
  id: string
  tarea_id: string | null
  agente_id: string | null
  cliente_id: string | null
  tipo_accion: string
  titulo: string
  detalle: Record<string, unknown>
}

export async function decidirAprobacion(aprobacionId: string, decision: 'aprobada' | 'rechazada', comentario: string, token: string) {
  const db = crearDb(token)
  const ahora = new Date().toISOString()

  // Antes de aprobar algo de Google, comprobar que está conectado (así no se pierde la aprobación)
  if (decision === 'aprobada') {
    const { data: previa } = await db.from('aprobaciones').select('tipo_accion').eq('id', aprobacionId).maybeSingle()
    if (previa && CON_GOOGLE.includes(previa.tipo_accion) && !googleConectado()) {
      throw new Error('Primero conecta tu cuenta de Google en Ajustes y vuelve a aprobar.')
    }
    if (previa?.tipo_accion === 'enviar' && !gmailPermitido()) {
      throw new Error('Falta el permiso de Gmail: en Ajustes pulsa "Conectar Google" otra vez, marca la casilla de Gmail y vuelve a aprobar.')
    }
  }

  // Solo se decide lo que está pendiente en la bandeja (evita dobles clics y saltarse la revisión)
  const { data: aprobacion } = await db
    .from('aprobaciones')
    .update({ estado: decision, comentario: comentario || null, resuelto_en: ahora })
    .eq('id', aprobacionId)
    .eq('estado', 'pendiente')
    .select('*')
    .maybeSingle<AprobacionDb>()
  if (!aprobacion) throw new Error('Esta aprobación ya no está pendiente.')

  if (decision === 'rechazada') {
    const { data: tarea } = aprobacion.tarea_id ? await db.from('tareas').select('estado, intentos').eq('id', aprobacion.tarea_id).maybeSingle() : { data: null }
    // Solo se reabre la tarea si esperaba esta aprobación (no si ya estaba terminada, p. ej. subir al Drive unos copies viejos)
    if (aprobacion.tarea_id && tarea?.estado === 'esperando_aprobacion') {
      // Con comentario: el empleado la rehace teniéndolo en cuenta. Sin comentario: queda para que decidas tú.
      await db
        .from('tareas')
        .update({
          estado: comentario ? 'pendiente' : 'te_necesita',
          intentos: Number(tarea?.intentos ?? 0) + 1,
          revision: `Rafa rechazó "${aprobacion.titulo}"${comentario ? `: ${comentario}` : ' (sin comentario)'}`
        })
        .eq('id', aprobacion.tarea_id)
    }
    if (aprobacion.agente_id) await db.from('agentes').update({ estado: comentario ? 'disponible' : 'te_necesita' }).eq('id', aprobacion.agente_id)
    return
  }

  // Aprobada → ejecutar. Si falla, queda como "Falló" con el motivo y la tarea vuelve a ti.
  let resultado: Record<string, unknown>
  let fallo: string | null = null
  try {
    resultado = { ...(await ejecutar(db, aprobacion)), ejecutado_en: new Date().toISOString() }
  } catch (e) {
    fallo = e instanceof Error ? e.message : String(e)
    resultado = { mensaje: `No se pudo ejecutar: ${fallo}`, error: fallo }
  }
  await db.from('aprobaciones').update({ estado: fallo ? 'fallida' : 'ejecutada', resultado }).eq('id', aprobacion.id)

  if (aprobacion.tarea_id) {
    const { data: tarea } = await db.from('tareas').select('estado').eq('id', aprobacion.tarea_id).maybeSingle()
    if (fallo) {
      await db.from('tareas').update({ estado: 'te_necesita', revision: `No se pudo ejecutar "${aprobacion.titulo}": ${fallo}` }).eq('id', aprobacion.tarea_id)
    } else if (tarea?.estado === 'esperando_aprobacion') {
      // Si la tarea ya no tiene nada pendiente, se completa (y en la oficina sale el cofre)
      const { count } = await db
        .from('aprobaciones')
        .select('id', { count: 'exact', head: true })
        .eq('tarea_id', aprobacion.tarea_id)
        .in('estado', ['en_revision', 'pendiente', 'aprobada'])
      if (!count) await db.from('tareas').update({ estado: 'completada' }).eq('id', aprobacion.tarea_id)
    }
  }
  if (aprobacion.agente_id) await db.from('agentes').update({ estado: 'disponible' }).eq('id', aprobacion.agente_id)
}

async function ejecutar(db: SupabaseClient, a: AprobacionDb): Promise<Record<string, unknown>> {
  const d = a.detalle ?? {}
  const problema = problemaEnDetalle(a.tipo_accion, d)
  if (problema) throw new Error(problema)

  switch (a.tipo_accion) {
    case 'enviar': {
      const para = correosDe(d.para)
      const correo = await enviarCorreo({ para, cc: correosDe(d.cc), asunto: String(d.asunto).trim(), cuerpo: String(d.cuerpo) })
      return { mensaje: `Correo "${String(d.asunto).trim()}" enviado a ${para.join(', ')}`, enlace: correo.enlace, correo_id: correo.id }
    }
    case 'subir_archivo': {
      // El contenido es el entregable de la tarea; si la propuesta no viene de una tarea, el que traiga el detalle
      const { data: tarea } = a.tarea_id ? await db.from('tareas').select('titulo, resultado').eq('id', a.tarea_id).maybeSingle() : { data: null }
      const contenido = String(tarea?.resultado ?? d.contenido ?? '').trim()
      if (!contenido) throw new Error('No hay contenido para subir (la tarea aún no tiene entregable).')
      const { data: cliente } = a.cliente_id ? await db.from('clientes').select('nombre').eq('id', a.cliente_id).maybeSingle() : { data: null }
      const doc = await crearDocumento({
        titulo: String(d.titulo_documento ?? '').trim() || tarea?.titulo || a.titulo,
        contenido,
        clienteId: a.cliente_id,
        clienteNombre: cliente?.nombre ?? 'General',
        subcarpeta: typeof d.carpeta === 'string' ? d.carpeta : undefined
      })
      return { mensaje: `Documento "${doc.nombre}" creado en ${doc.carpeta}`, enlace: doc.enlace, documento_id: doc.id, carpeta: doc.carpeta }
    }
    case 'agendar_reunion': {
      const invitados = correosDe(d.invitados)
      const evento = await crearEvento({
        titulo: String(d.titulo),
        descripcion: String(d.descripcion ?? ''),
        fecha: String(d.fecha),
        hora: String(d.hora).padStart(5, '0'),
        duracionMin: Math.min(Math.max(Number(d.duracion_minutos) || 30, 5), 600),
        invitados,
        zona: String(d.zona_horaria ?? '').trim() || Intl.DateTimeFormat().resolvedOptions().timeZone,
        videollamada: String(d.videollamada ?? 'si').toLowerCase() !== 'no'
      })
      return {
        mensaje: `Reunión agendada el ${d.fecha} a las ${d.hora} con ${invitados.join(', ')} (invitaciones enviadas)`,
        enlace: evento.enlace,
        meet: evento.meet,
        evento_id: evento.id
      }
    }
    case 'publicar': {
      if (String(d.plataforma ?? '').toLowerCase() === 'netlify') return await publicarEnNetlify(String(d.trabajo).trim())
      return { simulado: true, mensaje: `Simulación: se habría publicado → ${a.titulo}` }
    }
    default:
      return { simulado: true, mensaje: `Simulación: se habría ejecutado "${a.tipo_accion}" → ${a.titulo}` }
  }
}
