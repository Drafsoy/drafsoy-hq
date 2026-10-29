import { usarDatos } from '@/datos/DatosProvider'

// Presupuesto de IA que te queda este mes (va sobre una tarjeta oscura)
export default function BarraEscudo() {
  const { gastoDelMes, ajustes } = usarDatos()
  const tope = Number(ajustes?.tope_mensual_usd ?? 50)
  const restante = Math.max(tope - gastoDelMes, 0)
  const porcentaje = tope > 0 ? Math.min((restante / tope) * 100, 100) : 0
  const color = porcentaje > 50 ? 'bg-lima' : porcentaje > 20 ? 'bg-amber-300' : 'bg-alerta'

  return (
    <div>
      <p className="text-xs font-semibold tracking-wider text-white/50 uppercase">Presupuesto de IA del mes</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">
        ${restante.toFixed(2)} <span className="text-sm font-medium text-white/50">de ${tope.toFixed(0)}</span>
      </p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${porcentaje}%` }} />
      </div>
      <p className="mt-2 text-xs text-white/50">Gastado este mes: ${gastoDelMes.toFixed(2)}</p>
    </div>
  )
}
