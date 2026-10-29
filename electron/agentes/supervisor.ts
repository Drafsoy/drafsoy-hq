import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ADMITE_BUSQUEDA_WEB,
  COLUMNAS_AGENTE,
  Contador,
  crearAnthropic,
  llamarModelo,
  memoriaDelCliente,
  mensajeError,
  superaTope,
  type AgenteDb
} from './comun'

// El supervisor (el agente de Rafa) revisa TODO lo que entrega un empleado:
// el resultado y cada acción externa propuesta. Contrasta con información real (búsqueda web
// y memoria del cliente). Solo lo que aprueba llega a la bandeja de Rafa.

const MAX_VUELTAS = 10
const MAX_INTENTOS = 3
// Lo que lleva más de esto "en revisión" sin que este proceso lo esté revisando, se quedó huérfano (la app se cerró a medias)
const MINUTOS_HUERFANA = 10

// Lo que se está revisando ahora mismo en este proceso (para no confundirlo con huérfanos ni revisarlo dos veces)
const tareasEnRevision = new Set<string>()
const propuestasEnRevision = new Set<string>()

interface Veredicto {
  decision: 'aprobar' | 'devolver'
  nota: string
  correcciones?: string
  acciones?: { id: string; decision: 'aprobar' | 'rechazar'; nota?: string }[]
}

export async function revisarTarea(db: SupabaseClient, tareaId: string): Promise<void> {
  if (tareasEnRevision.has(tareaId)) return
  tareasEnRevision.add(tareaId)
  try {
    await revisarTareaYa(db, tareaId)
  } finally {
    tareasEnRevision.delete(tareaId)
  }
}

async function revisarTareaYa(db: SupabaseClient, tareaId: string): Promise<void> {
  const { data: tarea } = await db.from('tareas').select('*').eq('id', tareaId).single()
  if (!tarea) return
  const { data: supervisor } = await db.from('agentes').select(COLUMNAS_AGENTE).eq('es_supervisor', true).limit(1).maybeSingle<AgenteDb>()
  const { data: propuestas } = await db.from('aprobaciones').select('id, tipo_accion, titulo, detalle').eq('tarea_id', tareaId).eq('estado', 'en_revision')

  if (!supervisor) {
    // Sin supervisor no se aprueba nada solo: Rafa decide
    await aplicar(db, tarea, { decision: 'aprobar', nota: 'Sin supervisor configurado: pasa directo a Rafa.' }, propuestas ?? [], null)
    return
  }

  const aviso = await superaTope(db, supervisor)
  if (aviso) {
    await db.from('tareas').update({ estado: 'te_necesita', revision: `El supervisor no pudo revisar: ${aviso}` }).eq('id', tareaId)
    return
  }

  await db.from('agentes').update({ estado: 'trabajando' }).eq('id', supervisor.id)
  const contador = new Contador(supervisor.modelo)
  try {
    const veredicto = await decidir(db, supervisor, tarea, propuestas ?? [], contador)
    await aplicar(db, tarea, veredicto, propuestas ?? [], supervisor.nombre)
  } catch (e) {
    await db.from('tareas').update({ estado: 'te_necesita', revision: `El supervisor no pudo revisar: ${mensajeError(e)}` }).eq('id', tareaId)
  } finally {
    await contador.registrar(db, supervisor.id, tareaId)
    await db.from('agentes').update({ estado: 'disponible' }).eq('id', supervisor.id)
  }
}

// Cómo piensa el supervisor (igual para tareas y para propuestas sueltas)
const sistema = (yo: AgenteDb) =>
  [
    `Eres ${yo.nombre}, el supervisor de Drafsoy HQ y la mano derecha de Rafa. Escribes en español.`,
    yo.instrucciones,
    'Cómo revisas:',
    '- ¿Cumple exactamente lo que se pidió (cantidad, formato, plazo)?',
    '- ¿Respeta la memoria del cliente (tono, público, prohibiciones)?',
    '- ¿Los datos son reales? Comprueba con búsqueda web las afirmaciones verificables (precios, ofertas, datos de mercado, nombres, fechas, políticas de las plataformas). Si algo no se puede verificar y es importante, devuélvelo.',
    '- Acciones externas propuestas: apruébalas solo si están completas, son seguras y tienen sentido (presupuestos razonables, textos correctos, destinatarios claros). Si alguna es dudosa, recházala.',
    '- subir_archivo crea un Google Doc en el Drive del cliente con el entregable tal cual: apruébala solo si el contenido es final, correcto y apto para el cliente (sin notas internas, corchetes ni pendientes).',
    '- publicar con detalle.plataforma "netlify" sube SOLO el HTML del trabajo al sitio fijado en su carpeta (las notas y demás archivos de la carpeta nunca se suben). Si el entregable dice que el script de verificación pasó y las cifras son coherentes, apruébala. Si queda un dato que solo Rafa puede confirmar (por ejemplo la moneda de un gasto o el filtro de una captura), no la rechaces: apruébala y escribe en su nota, en una lista corta, qué debe confirmar o revisar Rafa antes de darle el sí en su bandeja. Rechaza solo si los números no cuadran o falta el trabajo hecho.',
    '- enviar manda un correo REAL desde el Gmail de Rafa: comprueba que los destinatarios son correos reales que aparecen en la tarea o en la memoria del cliente (nunca inventados), que el asunto y el cuerpo están completos, sin corchetes ni notas internas, con el tono del cliente y sin promesas o datos sin verificar.',
    '- agendar_reunion crea un evento en Google Calendar y ENVÍA invitaciones: comprueba que la fecha es futura y coherente (día laborable, hora razonable), que los invitados son correos reales mencionados por Rafa o en la memoria del cliente (nunca inventados) y que título y descripción son claros.',
    '- Sé exigente pero práctico: no devuelvas por detalles menores de estilo.',
    '- Termina siempre llamando a veredicto.'
  ].join('\n')

async function decidir(
  db: SupabaseClient,
  yo: AgenteDb,
  tarea: Record<string, unknown>,
  propuestas: { id: string; tipo_accion: string; titulo: string; detalle: unknown }[],
  contador: Contador
): Promise<Veredicto> {
  const { cliente, memoria } = await memoriaDelCliente(db, (tarea.cliente_id as string) ?? null)
  const { data: autor } = await db.from('agentes').select('nombre, rol').eq('id', tarea.agente_id as string).maybeSingle()

  const expediente = {
    tarea: { titulo: tarea.titulo, descripcion: tarea.descripcion, tipo: tarea.tipo, prioridad: tarea.prioridad, fecha_limite: tarea.fecha_limite, intento: Number(tarea.intentos ?? 0) + 1 },
    autor,
    cliente: cliente ? { nombre: cliente.nombre, descripcion: cliente.descripcion } : null,
    memoria_del_cliente: memoria,
    entregable: tarea.resultado,
    notas_del_empleado: typeof tarea.revision === 'string' && tarea.revision.startsWith('📝') ? tarea.revision : null,
    acciones_propuestas: propuestas,
    hoy: new Date().toLocaleDateString('sv')
  }
  return pedirVeredicto(yo, `Revisa este trabajo (JSON):\n${JSON.stringify(expediente, null, 2)}`, contador)
}

async function pedirVeredicto(yo: AgenteDb, encargo: string, contador: Contador): Promise<Veredicto> {
  const anthropic = crearAnthropic()
  const herramientas: Anthropic.Beta.BetaToolUnion[] = [
    {
      name: 'veredicto',
      description:
        'Da tu decisión final sobre el trabajo. Llámala una sola vez. "aprobar" si cumple lo pedido, respeta al cliente y los datos son correctos; "devolver" con correcciones concretas si no. Decide también cada acción propuesta.',
      input_schema: {
        type: 'object',
        properties: {
          decision: { type: 'string', enum: ['aprobar', 'devolver'] },
          nota: { type: 'string', description: 'Resumen de tu revisión para Rafa (2-4 líneas): qué comprobaste y por qué apruebas o devuelves' },
          correcciones: { type: 'string', description: 'Si devuelves: lista concreta de lo que el empleado debe cambiar' },
          acciones: {
            type: 'array',
            description: 'Tu decisión sobre cada acción propuesta (si hay)',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                decision: { type: 'string', enum: ['aprobar', 'rechazar'] },
                nota: { type: 'string' }
              },
              required: ['id', 'decision']
            }
          }
        },
        required: ['decision', 'nota']
      }
    }
  ]
  if (ADMITE_BUSQUEDA_WEB.has(yo.modelo)) {
    herramientas.push({ type: 'web_search_20260209', name: 'web_search', max_uses: 5 })
  }

  const system = sistema(yo)
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: encargo }]

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const respuesta = await llamarModelo(anthropic, { model: yo.modelo, max_tokens: 16000, system, tools: herramientas, messages })
    contador.sumar(respuesta.usage)
    if (respuesta.stop_reason === 'refusal') throw new Error('El modelo del supervisor rechazó la revisión.')
    messages.push({ role: 'assistant', content: respuesta.content })

    // La búsqueda web corre en el servidor; si pausa el turno, se continúa tal cual
    if (respuesta.stop_reason === 'pause_turn') continue

    const usos = respuesta.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    const veredicto = usos.find((u) => u.name === 'veredicto')
    if (veredicto) {
      const v = veredicto.input as Veredicto
      if (v.decision !== 'aprobar' && v.decision !== 'devolver') throw new Error('Veredicto no válido.')
      // A veces el modelo manda la lista de acciones como texto JSON en vez de como lista
      let acciones: unknown = v.acciones
      if (typeof acciones === 'string') {
        try {
          acciones = JSON.parse(acciones)
        } catch {
          acciones = []
        }
      }
      if (acciones && !Array.isArray(acciones) && typeof acciones === 'object') acciones = [acciones]
      v.acciones = Array.isArray(acciones) ? acciones.filter((a) => a && typeof a === 'object' && typeof a.id === 'string') : []
      return v
    }
    messages.push({
      role: 'user',
      content: usos.length
        ? usos.map((u) => ({ type: 'tool_result' as const, tool_use_id: u.id, content: 'Herramienta desconocida. Usa veredicto.', is_error: true }))
        : 'Da tu decisión con la herramienta veredicto.'
    })
  }
  throw new Error('El supervisor no llegó a una decisión.')
}

// Propuestas que no vienen de un entregable nuevo (las hace la recepcionista desde el chat):
// el supervisor revisa solo esas acciones; las que aprueba pasan a la bandeja de Rafa.
export async function revisarPropuestas(db: SupabaseClient, ids: string[]): Promise<void> {
  const libres = ids.filter((id) => !propuestasEnRevision.has(id))
  if (!libres.length) return
  for (const id of libres) propuestasEnRevision.add(id)
  try {
    await revisarPropuestasYa(db, libres)
  } finally {
    for (const id of libres) propuestasEnRevision.delete(id)
  }
}

async function revisarPropuestasYa(db: SupabaseClient, ids: string[]): Promise<void> {
  const { data } = await db.from('aprobaciones').select('id, tarea_id, cliente_id, tipo_accion, titulo, detalle').in('id', ids).eq('estado', 'en_revision')
  const propuestas = data ?? []
  if (!propuestas.length) return
  const { data: supervisor } = await db.from('agentes').select(COLUMNAS_AGENTE).eq('es_supervisor', true).limit(1).maybeSingle<AgenteDb>()

  // Si no se puede revisar, pasa a Rafa con un aviso bien visible (igual nunca se ejecuta sin su aprobación)
  const aRafaConAviso = async (aviso: string) => {
    for (const p of propuestas) await db.from('aprobaciones').update({ estado: 'pendiente', nota_supervisor: `⚠️ Sin revisar: ${aviso}` }).eq('id', p.id)
  }
  if (!supervisor) return aRafaConAviso('no hay supervisor configurado.')
  const aviso = await superaTope(db, supervisor)
  if (aviso) return aRafaConAviso(aviso)

  await db.from('agentes').update({ estado: 'trabajando' }).eq('id', supervisor.id)
  const contador = new Contador(supervisor.modelo)
  try {
    const { cliente, memoria } = await memoriaDelCliente(db, (propuestas[0].cliente_id as string | null) ?? null)
    const tareaIds = [...new Set(propuestas.map((p) => p.tarea_id).filter(Boolean))] as string[]
    const { data: tareas } = tareaIds.length ? await db.from('tareas').select('id, titulo, descripcion, resultado').in('id', tareaIds) : { data: [] }
    const expediente = {
      origen: 'Propuestas hechas por la recepcionista a partir de un mensaje de Rafa (no hay entregable nuevo que revisar).',
      cliente: cliente ? { nombre: cliente.nombre, descripcion: cliente.descripcion } : null,
      memoria_del_cliente: memoria,
      acciones_propuestas: propuestas.map((p) => ({ id: p.id, tipo_accion: p.tipo_accion, titulo: p.titulo, detalle: p.detalle })),
      // Para subir_archivo: lo que se va a subir
      entregables_relacionados: (tareas ?? []).map((t) => ({ tarea_id: t.id, titulo: t.titulo, descripcion: t.descripcion, contenido: String(t.resultado ?? '').slice(0, 20000) })),
      hoy: new Date().toLocaleDateString('sv')
    }
    const v = await pedirVeredicto(
      supervisor,
      `Revisa estas acciones propuestas (JSON). Decide cada una en "acciones".\n${JSON.stringify(expediente, null, 2)}`,
      contador
    )
    const firma = `${supervisor.nombre}: `
    const ahora = new Date().toISOString()
    const resumen: string[] = []
    for (const p of propuestas) {
      const d = v.acciones?.find((a) => a.id === p.id)
      const rechazar = d?.decision === 'rechazar' || (!d && v.decision === 'devolver')
      const nota = rechazar ? (d?.nota ?? v.correcciones ?? v.nota) : (d?.nota ?? v.nota)
      console.log(`[supervisor] propuesta "${p.titulo}": ${rechazar ? 'rechazada' : 'a la bandeja'} · ${nota}`)
      if (rechazar) {
        await db.from('aprobaciones').update({ estado: 'rechazada', comentario: `${firma}${nota}`, resuelto_en: ahora }).eq('id', p.id)
        resumen.push(`❌ No pasa: "${p.titulo}". Motivo: ${nota}`)
      } else {
        await db.from('aprobaciones').update({ estado: 'pendiente', nota_supervisor: `${firma}${nota}` }).eq('id', p.id)
        resumen.push(`✅ Ya está en tu bandeja para aprobar: "${p.titulo}".`)
      }
    }
    // Rafa se entera en el mismo chat donde lo pidió (y la recepcionista lo tiene en su historial)
    await db.from('mensajes').insert({
      canal: 'recepcion',
      rol: 'asistente',
      contenido: `${supervisor.nombre} revisó lo que propuse:\n${resumen.join('\n')}`,
      tarea_id: (propuestas[0].tarea_id as string | null) ?? null
    })
  } catch (e) {
    console.error('[supervisor] no pudo revisar propuestas:', e)
    await aRafaConAviso(`el supervisor falló (${mensajeError(e)}).`)
  } finally {
    await contador.registrar(db, supervisor.id, (propuestas[0].tarea_id as string | null) ?? null)
    await db.from('agentes').update({ estado: 'disponible' }).eq('id', supervisor.id)
  }
}

// Aplica el veredicto: actualiza propuestas, tarea y estado del empleado
async function aplicar(
  db: SupabaseClient,
  tarea: Record<string, unknown>,
  v: Veredicto,
  propuestas: { id: string }[],
  supervisor: string | null
) {
  const firma = supervisor ? `${supervisor}: ` : ''
  const ahora = new Date().toISOString()
  const empleado = tarea.agente_id as string

  if (v.decision === 'devolver') {
    for (const p of propuestas) {
      await db.from('aprobaciones').update({ estado: 'rechazada', comentario: `${firma}devuelto con la tarea`, resuelto_en: ahora }).eq('id', p.id)
    }
    const intentos = Number(tarea.intentos ?? 0) + 1
    const agotado = intentos >= MAX_INTENTOS
    await db
      .from('tareas')
      .update({
        estado: agotado ? 'te_necesita' : 'pendiente',
        intentos,
        revision: `${firma}${v.nota}${v.correcciones ? `\nCorrecciones: ${v.correcciones}` : ''}${agotado ? '\nSe devolvió varias veces: necesita tu criterio.' : ''}`
      })
      .eq('id', tarea.id)
    await db.from('agentes').update({ estado: agotado ? 'te_necesita' : 'disponible' }).eq('id', empleado)
    return
  }

  // Aprobado: cada acción propuesta pasa a la bandeja de Rafa (o se rechaza)
  let enBandeja = 0
  const frenadas: string[] = []
  for (const p of propuestas as { id: string; titulo?: string }[]) {
    const d = v.acciones?.find((a) => a.id === p.id)
    if (d?.decision === 'rechazar') {
      const motivo = d.nota ?? 'rechazada'
      await db.from('aprobaciones').update({ estado: 'rechazada', comentario: `${firma}${motivo}`, resuelto_en: ahora }).eq('id', p.id)
      frenadas.push(`🛑 "${p.titulo ?? 'Acción'}" no pasó: ${motivo}`)
    } else {
      await db.from('aprobaciones').update({ estado: 'pendiente', nota_supervisor: `${firma}${d?.nota ?? v.nota}` }).eq('id', p.id)
      enBandeja++
    }
  }

  // Si el supervisor frenó una acción que la tarea pedía, no está terminada: Rafa debe decidir o dar los datos que faltan
  const teNecesita = frenadas.length > 0 && enBandeja === 0
  await db
    .from('tareas')
    .update({
      estado: enBandeja ? 'esperando_aprobacion' : teNecesita ? 'te_necesita' : 'completada',
      revision: teNecesita
        ? `${frenadas.join('\n')}\n\n✅ El entregable está aprobado. Responde lo que falta (por ejemplo a Aura en el chat) y la tarea se rehace con esos datos.`
        : `✅ ${firma}${v.nota}`
    })
    .eq('id', tarea.id)
  await db
    .from('agentes')
    .update({ estado: enBandeja ? 'esperando_aprobacion' : teNecesita ? 'te_necesita' : 'disponible' })
    .eq('id', empleado)

  // Aviso en el chat de recepción para que Rafa se entere sin buscarlo
  if (teNecesita) {
    await db.from('mensajes').insert({
      canal: 'recepcion',
      rol: 'asistente',
      contenido: `${supervisor ?? 'El supervisor'} frenó una acción de la tarea "${tarea.titulo}":\n${frenadas.join('\n')}\nDime los datos que faltan y se rehace.`,
      tarea_id: tarea.id as string
    })
  }
}

// Al arrancar (y de vez en cuando) se retoma lo que un cierre de la app dejó a medias:
// - tareas "en progreso" que nadie está trabajando: si ya tenían su entregable, se revisan; si no, vuelven a pendiente
// - propuestas sueltas de la recepcionista que se quedaron "en revisión": el supervisor las revisa
// `trabajando` son las tareas que un empleado de este proceso tiene en cola o en marcha.
export async function rescatarHuerfanas(db: SupabaseClient, trabajando: ReadonlySet<string>): Promise<void> {
  const limite = new Date(Date.now() - MINUTOS_HUERFANA * 60_000).toISOString()

  const { data: tareas } = await db
    .from('tareas')
    .select('id, agente_id, resultado, intentos')
    .eq('estado', 'en_progreso')
    .lt('actualizado_en', limite)
  for (const t of tareas ?? []) {
    if (trabajando.has(t.id) || tareasEnRevision.has(t.id)) continue
    const { data: propias } = await db.from('aprobaciones').select('id').eq('tarea_id', t.id).eq('estado', 'en_revision')
    // El entregable es de este intento si es el primero o si dejó propuestas sin revisar (al devolver, las viejas se rechazan)
    const entregada = typeof t.resultado === 'string' && t.resultado.trim() && (Number(t.intentos ?? 0) === 0 || (propias ?? []).length > 0)
    if (entregada) {
      console.log(`[rescate] tarea ${t.id}: se cortó en la revisión, el supervisor la revisa otra vez`)
      await revisarTarea(db, t.id)
      continue
    }
    console.log(`[rescate] tarea ${t.id}: se cortó a medias, vuelve a pendiente`)
    const ahora = new Date().toISOString()
    for (const p of propias ?? []) {
      await db.from('aprobaciones').update({ estado: 'rechazada', comentario: 'La app se cerró mientras se hacía la tarea: se vuelve a hacer.', resuelto_en: ahora }).eq('id', p.id)
    }
    await db.from('tareas').update({ estado: 'pendiente' }).eq('id', t.id).eq('estado', 'en_progreso')
    if (t.agente_id) await db.from('agentes').update({ estado: 'disponible' }).eq('id', t.agente_id).eq('estado', 'trabajando')
  }

  // Propuestas sueltas (las de la recepcionista; las de un empleado van con su tarea, arriba)
  const { data: recepcionista } = await db.from('agentes').select('id').eq('es_recepcionista', true).limit(1).maybeSingle()
  const { data: sueltas } = await db
    .from('aprobaciones')
    .select('id, agente_id, tarea_id, cliente_id')
    .eq('estado', 'en_revision')
    .lt('creado_en', limite)
  const porCliente = new Map<string, string[]>()
  for (const p of sueltas ?? []) {
    if (propuestasEnRevision.has(p.id)) continue
    if (p.tarea_id && p.agente_id !== recepcionista?.id) continue
    // Se revisan juntas las del mismo cliente (el supervisor usa la memoria de ese cliente)
    const clave = (p.cliente_id as string | null) ?? ''
    porCliente.set(clave, [...(porCliente.get(clave) ?? []), p.id])
  }
  for (const ids of porCliente.values()) {
    console.log(`[rescate] ${ids.length} propuesta(s) sueltas se quedaron en revisión: el supervisor las revisa`)
    await revisarPropuestas(db, ids)
  }
}
