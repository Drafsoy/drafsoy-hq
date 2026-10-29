import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigurado } from '@/datos/supabase'
import { DatosProvider, usarDatos } from '@/datos/DatosProvider'
import { ContextoRuta, type Ruta } from '@/navegacion'
import BarraLateral from '@/componentes/BarraLateral'
import HUD from '@/componentes/HUD'
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
    ;(window as unknown as { __verAgente?: (n: string) => void }).__verAgente = (nombre: string) => {
      const a = agentes.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase())
      if (a) ir({ pantalla: 'agente', id: a.id })
    }
  }, [agentes])

  // En el mundo se ve la barra lateral; al abrir un panel se aparta para dejar ver la oficina.
  const enMundo = ruta.pantalla === 'mundo'

  return (
    <ContextoRuta.Provider value={{ ruta, ir }}>
      <div className="relative h-full overflow-hidden bg-cielo">
        <div className="absolute inset-0">
          <Escena />
        </div>

        <Orquestador />
        {enMundo && <BarraLateral />}
        <HUD barraVisible={enMundo} />

        {ruta.pantalla === 'cliente' && (
          <PanelLateral key={ruta.id} ancho={600}>
            <FichaCliente id={ruta.id} />
          </PanelLateral>
        )}
        {ruta.pantalla === 'agente' && (
          <PanelLateral key={ruta.id} ancho={760}>
            <FichaAgente id={ruta.id} />
          </PanelLateral>
        )}
        {ruta.pantalla === 'bandeja' && (
          <PanelLateral ancho={620}>
            <Bandeja />
          </PanelLateral>
        )}
        {ruta.pantalla === 'chat' && (
          <PanelLateral key={ruta.agenteId ?? 'recepcion'} ancho={540}>
            <ChatRecepcion agenteId={ruta.agenteId} />
          </PanelLateral>
        )}
        {ruta.pantalla === 'nuevoAgente' && (
          <PanelLateral ancho={760}>
            <NuevoAgente />
          </PanelLateral>
        )}
        {ruta.pantalla === 'nuevoCliente' && (
          <PanelLateral ancho={560}>
            <NuevoCliente />
          </PanelLateral>
        )}
        {ruta.pantalla === 'ajustes' && (
          <PanelLateral ancho={600}>
            <Ajustes />
          </PanelLateral>
        )}

        {error && <p className="absolute top-4 left-1/2 -translate-x-1/2 rounded-lg bg-alerta px-3 py-1 text-sm font-bold">{error}</p>}
      </div>
    </ContextoRuta.Provider>
  )
}

function PantallaCarga({ texto }: { texto: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-noche">
      <p className="titulo-juego text-3xl text-oro">{texto}</p>
    </div>
  )
}
