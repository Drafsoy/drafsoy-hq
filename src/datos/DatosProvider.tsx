import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { usarTabla } from './usarTabla'
import type { Agente, AgenteCliente, Ajustes, Aprobacion, Cliente, Gasto, MemoriaCliente, Mensaje, Tarea } from './tipos'

interface Datos {
  clientes: Cliente[]
  asignaciones: AgenteCliente[]
  agentes: Agente[]
  tareas: Tarea[]
  aprobaciones: Aprobacion[]
  mensajes: Mensaje[]
  memoria: MemoriaCliente[]
  gastos: Gasto[]
  ajustes: Ajustes | null
  gastoDelMes: number
  cargando: boolean
  error: string | null
}

const Contexto = createContext<Datos | null>(null)

// Todas las pantallas leen de aquí. Todo se mantiene al día en tiempo real.
export function DatosProvider({ children }: { children: ReactNode }) {
  const clientes = usarTabla<Cliente>('clientes')
  const asignaciones = usarTabla<AgenteCliente>('agente_clientes')
  const agentes = usarTabla<Agente>('agentes')
  const tareas = usarTabla<Tarea>('tareas')
  const aprobaciones = usarTabla<Aprobacion>('aprobaciones')
  const mensajes = usarTabla<Mensaje>('mensajes')
  const memoria = usarTabla<MemoriaCliente>('memoria_cliente')
  const gastos = usarTabla<Gasto>('gastos')
  const ajustes = usarAjustes()

  const gastoDelMes = useMemo(() => {
    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)
    return gastos.filas
      .filter((g) => new Date(g.creado_en) >= inicioMes)
      .reduce((suma, g) => suma + Number(g.costo_usd), 0)
  }, [gastos.filas])

  const error =
    clientes.error || asignaciones.error || agentes.error || tareas.error || aprobaciones.error || mensajes.error || memoria.error || gastos.error

  const valor: Datos = {
    clientes: clientes.filas,
    asignaciones: asignaciones.filas,
    agentes: agentes.filas,
    tareas: tareas.filas,
    aprobaciones: aprobaciones.filas,
    mensajes: mensajes.filas,
    memoria: memoria.filas,
    gastos: gastos.filas,
    ajustes,
    gastoDelMes,
    cargando: clientes.cargando || asignaciones.cargando || agentes.cargando || tareas.cargando,
    error
  }

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

// Clientes que lleva un empleado, y empleados que llevan un cliente
export function clientesDeAgente(datos: Pick<Datos, 'clientes' | 'asignaciones'>, agenteId: string): Cliente[] {
  const ids = new Set(datos.asignaciones.filter((a) => a.agente_id === agenteId).map((a) => a.cliente_id))
  return datos.clientes.filter((c) => ids.has(c.id))
}

export function agentesDeCliente(datos: Pick<Datos, 'agentes' | 'asignaciones'>, clienteId: string): Agente[] {
  const ids = new Set(datos.asignaciones.filter((a) => a.cliente_id === clienteId).map((a) => a.agente_id))
  return datos.agentes.filter((a) => ids.has(a.id))
}

export function usarDatos(): Datos {
  const datos = useContext(Contexto)
  if (!datos) throw new Error('usarDatos debe usarse dentro de DatosProvider')
  return datos
}

// "ajustes" es una sola fila (no tiene id), así que va aparte.
function usarAjustes(): Ajustes | null {
  const [ajustes, setAjustes] = useState<Ajustes | null>(null)

  useEffect(() => {
    supabase
      .from('ajustes')
      .select('*')
      .maybeSingle()
      .then(({ data }) => setAjustes(data as Ajustes | null))

    const canal = supabase
      .channel(`ajustes-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ajustes' }, (cambio) => {
        if (cambio.eventType !== 'DELETE') setAjustes(cambio.new as Ajustes)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [])

  return ajustes
}
