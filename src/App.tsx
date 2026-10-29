import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigurado } from '@/datos/supabase'
import { DatosProvider, usarDatos } from '@/datos/DatosProvider'
import { ContextoRuta, type Ruta } from '@/navegacion'
import BarraLateral from '@/componentes/BarraLateral'
import BarraIconos from '@/componentes/BarraIconos'
import BarraSuperior from '@/componentes/BarraSuperior'
import PanelLateral from '@/componentes/PanelLateral'
import Orquestador from '@/componentes/Orquestador'
import Escena from '@/mundo3d/Escena'
import Login from '@/pantallas/Login'
import FaltaConfig from '@/pantallas/FaltaConfig'
import FichaCliente from '@/pantallas/FichaCliente'
import FichaAgente from '@/pantallas/FichaAgente'
import Bandeja from '@/pantallas/Bandeja'
import ChatRecepcion from '@/pantallas/ChatRecepcion'
import Ajustes from '@/pantallas/Ajustes'
import Analitica from '@/pantallas/Analitica'
import NuevoAgente from '@/pantallas/NuevoAgente'
import NuevoCliente from '@/pantallas/NuevoCliente'

export default function App() {
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => setSesion(nueva))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!supabaseConfigurado) return <FaltaConfig />
  if (sesion === undefined) return <PantallaCarga texto="Cargando…" />
  if (!sesion) return <Login />
  return <Oficina />
}

function Oficina() {
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // La primera vez que entras se crean los clientes y empleados iniciales.
  useEffect(() => {
    supabase.rpc('sembrar_inicio').then(({ error }) => {
      if (error) setError(error.message)
      else setListo(true)
    })
  }, [])

  if (error) return <PantallaCarga texto={`No pude preparar la oficina: ${error}`} />
  if (!listo) return <PantallaCarga texto="Abriendo la oficina…" />
  return (
    <DatosProvider>
      <OficinaLista />
    </DatosProvider>
  )
}

function OficinaLista() {
  const [ruta, ir] = useState<Ruta>({ pantalla: 'mundo' })
  const { error, agentes } = usarDatos()

  // Solo en desarrollo: permite a las capturas automáticas abrir la ficha de un agente
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __verAgente?: (n: string) => void; __ir?: (r: Ruta) => void }
    w.__verAgente = (nombre: string) => {
      const a = agentes.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase())
      if (a) ir({ pantalla: 'agente', id: a.id })
    }
    w.__ir = ir
  }, [agentes])

  const panel = (() => {
    switch (ruta.pantalla) {
      case 'cliente':
        return { ancho: 620, contenido: <FichaCliente id={ruta.id} />, clave: ruta.id }
      case 'agente':
        return { ancho: 760, contenido: <FichaAgente id={ruta.id} />, clave: ruta.id }
      case 'bandeja':
        return { ancho: 640, contenido: <Bandeja />, clave: 'bandeja' }
      case 'chat':
        return { ancho: 560, contenido: <ChatRecepcion agenteId={ruta.agenteId} />, clave: ruta.agenteId ?? 'recepcion' }
      case 'nuevoAgente':
        return { ancho: 760, contenido: <NuevoAgente />, clave: 'nuevoAgente' }
      case 'nuevoCliente':
        return { ancho: 580, contenido: <NuevoCliente />, clave: 'nuevoCliente' }
      case 'ajustes':
        return { ancho: 620, contenido: <Ajustes />, clave: 'ajustes' }
      case 'analitica':
        return { ancho: 980, maximo: '72%', contenido: <Analitica />, clave: 'analitica' }
      default:
        return null
    }
  })()

  // Dashboard: barra de iconos, barra de arriba, el mapa 3D como tarjeta central y una columna a la derecha
  // (el resumen del día o, si abres algo, su ficha).
  return (
    <ContextoRuta.Provider value={{ ruta, ir }}>
      <div className="flex h-full gap-4 bg-fondo p-4">
        <BarraIconos />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <BarraSuperior />
          <div className="flex min-h-0 flex-1 gap-4">
            <div className="relative min-w-0 flex-1 overflow-hidden rounded-3xl bg-cielo shadow-[0_8px_24px_rgb(16_24_40/0.08)]">
              <div className="absolute inset-0">
                <Escena />
              </div>
              <span className="pointer-events-none absolute top-4 left-4 flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold text-tinta backdrop-blur">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Oficina en vivo
              </span>
              {error && <p className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-alerta px-3 py-1 text-sm font-semibold text-white">{error}</p>}
            </div>
            {panel ? (
              <PanelLateral key={panel.clave} ancho={panel.ancho} maximo={'maximo' in panel ? panel.maximo : undefined}>
                {panel.contenido}
              </PanelLateral>
            ) : (
              <BarraLateral />
            )}
          </div>
        </div>
        <Orquestador />
      </div>
    </ContextoRuta.Provider>
  )
}

function PantallaCarga({ texto }: { texto: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-fondo">
      <p className="text-2xl font-bold text-tinta">{texto}</p>
    </div>
  )
}
