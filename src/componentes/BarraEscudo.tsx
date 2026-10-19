import { usarDatos } from '@/datos/DatosProvider'

// Barra de "escudo" del juego: presupuesto de IA que te queda este mes.
export default function BarraEscudo({ ancho = 'w-80' }: { ancho?: string }) {
  const { gastoDelMes, ajustes } = usarDatos()
  const tope = Number(ajustes?.tope_mensual_usd ?? 50)
  const restante = Math.max(tope - gastoDelMes, 0)
  const porcentaje = tope > 0 ? Math.min((restante / tope) * 100, 100) : 0
  const color =
    porcentaje > 50 ? 'from-sky-300 to-escudo' : porcentaje > 20 ? 'from-yellow-200 to-oro' : 'from-rose-300 to-alerta'

  return (
    <div className={ancho}>
      <div className="mb-1 flex items-end justify-between">
        <span className="titulo-juego text-sm text-white">🛡️ Presupuesto IA</span>
        <span className="titulo-juego text-lg text-white">
          ${restante.toFixed(2)} <span className="text-xs text-white/60">de ${tope.toFixed(0)}</span>
        </span>
      </div>
      <div className="relative h-6 -skew-x-12 overflow-hidden rounded-sm border-2 border-black/60 bg-black/50">
        <div className={`h-full bg-gradient-to-b ${color} transition-all duration-700`} style={{ width: `${porcentaje}%` }} />
        {/* Divisiones como en la barra del juego */}
        <div className="absolute inset-0 flex">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex-1 border-r-2 border-black/30 last:border-r-0" />
          ))}
        </div>
      </div>
    </div>
  )
}
