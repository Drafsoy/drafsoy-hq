import type { ReactNode } from 'react'
import { ClipboardList, Inbox, Keyboard, Moon, Plus, Sun, Sunrise, Sunset } from 'lucide-react'
import { usarDatos } from '@/datos/DatosProvider'
import { TAREA_ABIERTA } from '@/datos/tipos'
import { momentoDelDia, usarReloj } from '@/datos/reloj'
import { usarRuta } from '@/navegacion'

const SALUDO = { madrugada: 'Buenas noches', manana: 'Buenos días', tarde: 'Buenas tardes', noche: 'Buenas noches' }
const ICONO = { madrugada: <Moon size={18} />, manana: <Sunrise size={18} />, tarde: <Sun size={18} />, noche: <Sunset size={18} /> }

// Barra de arriba: saludo, fecha y hora en vivo, resumen del día y "Nuevo trabajo"
export default function BarraSuperior() {
  const { tareas, aprobaciones, agentes } = usarDatos()
  const { ir } = usarRuta()
  const ahora = usarReloj()
  const momento = momentoDelDia(ahora)

  const abiertas = tareas.filter(TAREA_ABIERTA).length
  const trabajando = agentes.filter((a) => a.estado === 'trabajando').length
  const pendientes = aprobaciones.filter((a) => a.estado === 'pendiente').length
  const fecha = ahora.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
  const hora = ahora.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

  return (
    <header className="flex shrink-0 items-center gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-3xl font-bold tracking-tight text-tinta">{SALUDO[momento]}, Rafa 👋</h1>
        <p className="text-sm text-tinta-suave first-letter:uppercase">
          {fecha} · <span className="font-semibold text-violeta">{abiertas === 0 ? 'sin tareas abiertas' : `${abiertas} ${abiertas === 1 ? 'tarea abierta' : 'tareas abiertas'}`}</span>
        </p>
      </div>

      <Dato icono={<ClipboardList size={16} />} valor={abiertas} texto="Abiertas" />
      <Dato icono={<Keyboard size={16} />} valor={trabajando} texto="Trabajando" />
      <Dato icono={<Inbox size={16} />} valor={pendientes} texto="Por aprobar" alerta={pendientes > 0} alPulsar={() => ir({ pantalla: 'bandeja' })} />

      {/* Reloj */}
      <div className="flex items-center gap-3 rounded-full border border-linea bg-tarjeta py-2 pr-5 pl-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violeta-suave text-violeta">{ICONO[momento]}</span>
        <span className="text-2xl font-bold tracking-tight text-tinta tabular-nums">{hora}</span>
      </div>

      <button onClick={() => ir({ pantalla: 'chat' })} className="flex items-center gap-2 rounded-full bg-tinta py-3 pr-5 pl-4 text-sm font-semibold text-white transition hover:bg-black">
        <Plus size={18} /> Nuevo trabajo
      </button>
    </header>
  )
}

function Dato({ icono, valor, texto, alerta, alPulsar }: { icono: ReactNode; valor: number; texto: string; alerta?: boolean; alPulsar?: () => void }) {
  return (
    <button
      onClick={alPulsar}
      disabled={!alPulsar}
      className={`flex items-center gap-2.5 rounded-full border py-2 pr-4 pl-2 transition ${alerta ? 'border-rose-200 bg-rose-50 hover:bg-rose-100' : 'border-linea bg-tarjeta'}`}
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${alerta ? 'bg-alerta text-white' : 'bg-suave text-tinta-suave'}`}>{icono}</span>
      <span className="text-left leading-tight">
        <span className="block text-lg font-bold text-tinta">{valor}</span>
        <span className="block text-[11px] font-medium text-tinta-suave">{texto}</span>
      </span>
    </button>
  )
}
