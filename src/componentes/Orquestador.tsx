import { useEffect, useRef } from 'react'
import { supabase } from '@/datos/supabase'
import { usarDatos } from '@/datos/DatosProvider'

// Invisible: cuando hay tareas pendientes asignadas a un empleado, le pide que se ponga a trabajar.
// También retoma lo que un cierre de la app dejó a medias (al arrancar y cada pocos minutos).
// Se puede pausar con "Trabajo automático" en Ajustes.
const CADA_RESCATE_MS = 5 * 60_000

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

  useEffect(() => {
    if (!ajustes?.trabajo_automatico) return
    const listas = tareas.filter((t) => {
      if (t.estado !== 'pendiente' || !t.agente_id) return false
      const agente = agentes.find((a) => a.id === t.agente_id)
      return agente && !agente.es_recepcionista && !agente.es_supervisor && !pedidas.current.has(`${t.id}:${t.intentos}`)
    })
    if (!listas.length) return
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token
      if (!token) return
      for (const t of listas) {
        pedidas.current.add(`${t.id}:${t.intentos}`)
        window.drafsoy.agentes.trabajar(t.id, t.agente_id!, token)
      }
    })
  }, [tareas, agentes, ajustes?.trabajo_automatico])

  return null
}
