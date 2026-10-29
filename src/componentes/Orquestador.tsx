import { useEffect, useRef } from 'react'
import { supabase } from '@/datos/supabase'
import { usarDatos } from '@/datos/DatosProvider'
import type { Agente } from '@/datos/tipos'

// Invisible: cuando hay tareas pendientes asignadas a un empleado, le pide que se ponga a trabajar.
// También retoma lo que un cierre de la app dejó a medias (al arrancar y cada pocos minutos).
// Se puede pausar con "Trabajo automático" en Ajustes.
const CADA_RESCATE_MS = 5 * 60_000
const CADA_RELOJ_MS = 60_000

const hoyLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Apunta las tareas recurrentes que tocan hoy y ya pasó su hora. Si la app estaba cerrada a esa hora, se apunta al abrirla (ese mismo día).
async function apuntarRecurrentes(agentes: Agente[]) {
  const ahora = new Date()
  const hoy = hoyLocal()
  const minutos = ahora.getHours() * 60 + ahora.getMinutes()
  for (const a of agentes) {
    const lista = a.tareas_recurrentes ?? []
    const tocan = lista.filter((t) => {
      if (typeof t.dia !== 'number' || !t.hora || t.ultima === hoy || t.dia !== ahora.getDay()) return false
      const [h, m] = t.hora.split(':').map(Number)
      return minutos >= h * 60 + (m || 0)
    })
    if (!tocan.length) continue
    // Primero se marca el día (así otra ventana o un segundo intento no la duplican) y luego se crea la tarea
    const nueva = lista.map((t) => (tocan.includes(t) ? { ...t, ultima: hoy } : t))
    const { error } = await supabase.from('agentes').update({ tareas_recurrentes: nueva }).eq('id', a.id)
    if (error) continue
    for (const t of tocan) {
      await supabase.from('tareas').insert({
        titulo: `🔁 ${t.texto.split('\n')[0].slice(0, 90)}`,
        descripcion: `Tarea semanal de ${a.nombre} (${hoy}).\n\n${t.texto}`,
        agente_id: a.id,
        cliente_id: t.cliente_id ?? null,
        prioridad: 'alta'
      })
    }
  }
}

export default function Orquestador() {
  const { tareas, agentes, ajustes } = usarDatos()
  const pedidas = useRef(new Set<string>())

  useEffect(() => {
    if (!ajustes?.trabajo_automatico) return
    const rescatar = () =>
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token
        if (token) window.drafsoy.agentes.rescatar(token)
      })
    rescatar()
    const intervalo = setInterval(rescatar, CADA_RESCATE_MS)
    return () => clearInterval(intervalo)
  }, [ajustes?.trabajo_automatico])

  // Reloj de tareas recurrentes: revisa cada minuto mientras la app está abierta
  const agentesRef = useRef(agentes)
  agentesRef.current = agentes
  useEffect(() => {
    if (!ajustes?.trabajo_automatico) return
    const revisar = () => apuntarRecurrentes(agentesRef.current).catch((e) => console.error('[recurrentes]', e))
    revisar()
    const intervalo = setInterval(revisar, CADA_RELOJ_MS)
    return () => clearInterval(intervalo)
  }, [ajustes?.trabajo_automatico])

  useEffect(() => {
    if (!ajustes?.trabajo_automatico) return
    const listas = tareas.filter((t) => {
      // La clave lleva la última modificación: si Rafa la retoma desde el chat (intentos vuelve a 0), se vuelve a pedir
      if (t.estado !== 'pendiente' || !t.agente_id) return false
      const agente = agentes.find((a) => a.id === t.agente_id)
      return agente && !agente.es_recepcionista && !agente.es_supervisor && !pedidas.current.has(`${t.id}:${t.intentos}:${t.actualizado_en}`)
    })
    if (!listas.length) return
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token
      if (!token) return
      for (const t of listas) {
        pedidas.current.add(`${t.id}:${t.intentos}:${t.actualizado_en}`)
        window.drafsoy.agentes.trabajar(t.id, t.agente_id!, token)
      }
    })
  }, [tareas, agentes, ajustes?.trabajo_automatico])

  return null
}
