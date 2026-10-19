import { usarDatos } from '@/datos/DatosProvider'
import { TAREA_ABIERTA } from '@/datos/tipos'
import { usarRuta, type Ruta } from '@/navegacion'
import BarraEscudo from './BarraEscudo'

// Contadores arriba y "barra de inventario" abajo, como en el juego.
export default function HUD({ barraVisible }: { barraVisible: boolean }) {
  const { tareas, aprobaciones, agentes } = usarDatos()
  const { ruta, ir } = usarRuta()
  const abiertas = tareas.filter(TAREA_ABIERTA).length
  const pendientes = aprobaciones.filter((a) => a.estado === 'pendiente').length
  const trabajando = agentes.filter((a) => a.estado === 'trabajando').length

  const ranuras: { ruta: Ruta; icono: string; texto: string; aviso?: number }[] = [
    { ruta: { pantalla: 'mundo' }, icono: '🏝️', texto: 'Mundo' },
    { ruta: { pantalla: 'chat' }, icono: '💬', texto: 'Recepción' },
    { ruta: { pantalla: 'bandeja' }, icono: '📥', texto: 'Aprobar', aviso: pendientes },
    { ruta: { pantalla: 'ajustes' }, icono: '⚙️', texto: 'Ajustes' }
  ]

  return (
    <>
      {/* Contadores */}
      <div className={`pointer-events-none absolute z-40 top-4 flex gap-2 transition-all duration-300 ${barraVisible ? 'left-[312px]' : 'left-4'}`}>
        <Contador icono="📋" valor={abiertas} texto="Tareas" />
        <Contador icono="⌨️" valor={trabajando} texto="Trabajando" />
        <Contador icono="📥" valor={pendientes} texto="Por aprobar" alerta={pendientes > 0} />
      </div>

      {/* Escudo + barra de ranuras */}
      <div className={`absolute z-40 bottom-4 flex items-end gap-4 transition-all duration-300 ${barraVisible ? 'left-[312px]' : 'left-4'}`}>
        <div className="panel-juego flex items-end gap-3 px-4 py-3">
          <BarraEscudo ancho="w-64" />
        </div>
        <div className="flex gap-2">
          {ranuras.map((r) => {
            const activa = ruta.pantalla === r.ruta.pantalla
            return (
              <button
                key={r.texto}
                onClick={() => ir(r.ruta)}
                className={`relative flex h-[74px] w-[74px] flex-col items-center justify-center rounded-xl border-[3px] transition hover:-translate-y-1 ${
                  activa ? 'border-white bg-gradient-to-b from-yellow-300 to-oro text-noche shadow-[0_0_20px_rgba(255,201,60,0.8)]' : 'border-white/30 bg-noche/80 text-white hover:border-white/70'
                }`}
              >
                <span className="text-2xl">{r.icono}</span>
                <span className="titulo-juego text-[11px]">{r.texto}</span>
                {!!r.aviso && (
                  <span className="titulo-juego absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-alerta px-1 text-xs text-white">
                    {r.aviso}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

function Contador({ icono, valor, texto, alerta }: { icono: string; valor: number; texto: string; alerta?: boolean }) {
  return (
    <div className={`inclinado rounded-lg border-2 px-3 py-1 ${alerta ? 'border-white bg-alerta' : 'border-white/25 bg-noche/80'}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icono}</span>
        <span className="titulo-juego text-2xl text-white">{valor}</span>
        <span className="text-[10px] font-black tracking-wider text-white/80 uppercase">{texto}</span>
      </div>
    </div>
  )
}
