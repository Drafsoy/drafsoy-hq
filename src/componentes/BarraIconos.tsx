import type { ReactNode } from 'react'
import { Briefcase, Inbox, LogOut, Map, MessageCircle, Settings, UserPlus } from 'lucide-react'
import { supabase } from '@/datos/supabase'
import { usarDatos } from '@/datos/DatosProvider'
import { usarRuta, type Ruta } from '@/navegacion'

// Barra oscura de iconos a la izquierda (navegación principal del dashboard)
export default function BarraIconos() {
  const { aprobaciones } = usarDatos()
  const { ruta, ir } = usarRuta()
  const pendientes = aprobaciones.filter((a) => a.estado === 'pendiente').length

  const botones: { ruta: Ruta; icono: ReactNode; texto: string; aviso?: number }[] = [
    { ruta: { pantalla: 'mundo' }, icono: <Map size={20} />, texto: 'Oficina' },
    { ruta: { pantalla: 'chat' }, icono: <MessageCircle size={20} />, texto: 'Recepción' },
    { ruta: { pantalla: 'bandeja' }, icono: <Inbox size={20} />, texto: 'Aprobar', aviso: pendientes },
    { ruta: { pantalla: 'nuevoAgente' }, icono: <UserPlus size={20} />, texto: 'Contratar' },
    { ruta: { pantalla: 'nuevoCliente' }, icono: <Briefcase size={20} />, texto: 'Nuevo cliente' }
  ]

  return (
    <nav className="flex w-[76px] shrink-0 flex-col items-center gap-2 rounded-3xl bg-barra py-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-lima text-lg font-extrabold text-tinta">D</div>
      {botones.map((b) => (
        <BotonIcono key={b.texto} activo={ruta.pantalla === b.ruta.pantalla && !(b.ruta.pantalla === 'chat' && 'agenteId' in ruta && ruta.agenteId)} texto={b.texto} aviso={b.aviso} alPulsar={() => ir(b.ruta)}>
          {b.icono}
        </BotonIcono>
      ))}
      <div className="flex-1" />
      <BotonIcono activo={ruta.pantalla === 'ajustes'} texto="Ajustes" alPulsar={() => ir({ pantalla: 'ajustes' })}>
        <Settings size={20} />
      </BotonIcono>
      <BotonIcono activo={false} texto="Salir" alPulsar={() => supabase.auth.signOut()}>
        <LogOut size={20} />
      </BotonIcono>
    </nav>
  )
}

function BotonIcono({ activo, texto, aviso, alPulsar, children }: { activo: boolean; texto: string; aviso?: number; alPulsar: () => void; children: ReactNode }) {
  return (
    <button
      onClick={alPulsar}
      title={texto}
      className={`group relative flex h-12 w-12 items-center justify-center rounded-2xl transition ${activo ? 'bg-lima text-tinta' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
    >
      {children}
      {!!aviso && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-alerta px-1 text-[11px] font-bold text-white ring-2 ring-barra">{aviso}</span>
      )}
      {/* Nombre del botón al pasar el ratón */}
      <span className="pointer-events-none absolute left-full z-50 ml-3 rounded-lg bg-barra px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-white opacity-0 shadow-lg transition group-hover:opacity-100">
        {texto}
      </span>
    </button>
  )
}
