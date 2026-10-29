import { useMemo, useState, type ReactNode } from 'react'
import { usarDatos } from '@/datos/DatosProvider'
import { TAREA_ABIERTA } from '@/datos/tipos'
import { Avatar, Pantalla, Titulo } from '@/componentes/ui'

// Analítica del sistema: cuánto trabaja el equipo, con qué calidad y cuánto cuesta.
// Todo sale de los datos que ya guarda la app (tareas, aprobaciones y gastos).

const DIAS = 14
const dia = (fecha: string | Date) => new Date(fecha).toLocaleDateString('sv') // AAAA-MM-DD en hora local

const ESTADOS_ACCION = [
  { estado: 'ejecutada', texto: 'Ejecutadas', color: '#22a55b' },
  { estado: 'pendiente', texto: 'Esperando tu sí', color: '#e0a106' },
  { estado: 'en_revision', texto: 'En revisión del supervisor', color: '#9aa0b4' },
  { estado: 'rechazada', texto: 'Rechazadas', color: '#e5484d' },
  { estado: 'fallida', texto: 'Fallaron', color: '#c2410c' }
] as const

export default function Analitica() {
  const { tareas, aprobaciones, gastos, agentes, clientes } = usarDatos()
  const supervisor = agentes.find((a) => a.es_supervisor)?.nombre ?? 'El supervisor'

  const datos = useMemo(() => {
    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)
    const completadas = tareas.filter((t) => t.estado === 'completada')
    const delMes = completadas.filter((t) => new Date(t.actualizado_en) >= inicioMes)
    const aLaPrimera = completadas.filter((t) => Number(t.intentos) === 0).length
    const gastoMes = gastos.filter((g) => new Date(g.creado_en) >= inicioMes).reduce((s, g) => s + Number(g.costo_usd), 0)

    // Mediana de minutos desde que se crea una tarea hasta que se completa
    const minutos = completadas.map((t) => (new Date(t.actualizado_en).getTime() - new Date(t.creado_en).getTime()) / 60000).sort((a, b) => a - b)
    const mediana = minutos.length ? minutos[Math.floor(minutos.length / 2)] : null

    // Coste por tarea: lo gastado en tareas completadas entre cuántas son
    const idsHechas = new Set(completadas.map((t) => t.id))
    const gastoHechas = gastos.filter((g) => g.tarea_id && idsHechas.has(g.tarea_id)).reduce((s, g) => s + Number(g.costo_usd), 0)

    // Últimos 14 días
    const dias: { clave: string; etiqueta: string; tareas: number; gasto: number }[] = []
    for (let i = DIAS - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dias.push({ clave: dia(d), etiqueta: d.toLocaleDateString('es', { day: 'numeric', month: 'short' }), tareas: 0, gasto: 0 })
    }
    for (const t of completadas) {
      const fila = dias.find((d) => d.clave === dia(t.actualizado_en))
      if (fila) fila.tareas++
    }
    for (const g of gastos) {
      const fila = dias.find((d) => d.clave === dia(g.creado_en))
      if (fila) fila.gasto += Number(g.costo_usd)
    }

    const porEmpleado = agentes
      .filter((a) => !a.es_recepcionista && !a.es_supervisor)
      .map((a) => {
        const suyas = tareas.filter((t) => t.agente_id === a.id)
        const hechas = suyas.filter((t) => t.estado === 'completada')
        return {
          agente: a,
          hechas: hechas.length,
          abiertas: suyas.filter(TAREA_ABIERTA).length,
          primera: hechas.length ? Math.round((hechas.filter((t) => Number(t.intentos) === 0).length / hechas.length) * 100) : null,
          gasto: gastos.filter((g) => g.agente_id === a.id && new Date(g.creado_en) >= inicioMes).reduce((s, g) => s + Number(g.costo_usd), 0)
        }
      })
      .sort((a, b) => b.hechas - a.hechas)

    // Gasto de la recepción y del supervisor (no hacen tareas, pero cuestan)
    const apoyo = agentes
      .filter((a) => a.es_recepcionista || a.es_supervisor)
      .map((a) => ({ agente: a, gasto: gastos.filter((g) => g.agente_id === a.id && new Date(g.creado_en) >= inicioMes).reduce((s, g) => s + Number(g.costo_usd), 0) }))

    const porCliente = clientes
      .map((c) => {
        const suyas = tareas.filter((t) => t.cliente_id === c.id)
        return { cliente: c, total: suyas.length, hechas: suyas.filter((t) => t.estado === 'completada').length, abiertas: suyas.filter(TAREA_ABIERTA).length }
      })
      .sort((a, b) => b.total - a.total)

    const acciones = ESTADOS_ACCION.map((e) => ({ ...e, cantidad: aprobaciones.filter((a) => a.estado === e.estado).length }))

    return {
      delMes: delMes.length,
      totalHechas: completadas.length,
      primera: completadas.length ? Math.round((aLaPrimera / completadas.length) * 100) : null,
      mediana,
      ejecutadas: aprobaciones.filter((a) => a.estado === 'ejecutada').length,
      gastoMes,
      costeTarea: completadas.length ? gastoHechas / completadas.length : null,
      dias,
      porEmpleado,
      apoyo,
      porCliente,
      acciones
    }
  }, [tareas, aprobaciones, gastos, agentes, clientes])

  return (
    <Pantalla>
      <Titulo>Analítica</Titulo>
      <p className="mt-1 text-sm text-tinta-suave">Cómo trabaja el equipo, con qué calidad y cuánto cuesta. Se actualiza solo.</p>

      {/* Cifras clave */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Cifra valor={String(datos.delMes)} texto="Tareas completadas este mes" detalle={`${datos.totalHechas} en total`} />
        <Cifra valor={datos.primera === null ? '—' : `${datos.primera}%`} texto="Aprobadas a la primera" detalle={`${supervisor} no tuvo que devolverlas`} />
        <Cifra valor={datos.mediana === null ? '—' : duracion(datos.mediana)} texto="Tiempo típico por tarea" detalle="Desde que se pide hasta que se termina" />
        <Cifra valor={String(datos.ejecutadas)} texto="Acciones reales hechas" detalle="Correos, Drive y Calendar aprobados" />
        <Cifra valor={`$${datos.gastoMes.toFixed(2)}`} texto="Gasto de IA este mes" detalle="Todos los agentes" />
        <Cifra valor={datos.costeTarea === null ? '—' : `$${datos.costeTarea.toFixed(2)}`} texto="Coste medio por tarea" detalle="Incluye las correcciones" />
      </div>

      {/* Dos gráficos separados: cada uno con su propia escala */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Bloque titulo="Tareas completadas por día" subtitulo={`Últimos ${DIAS} días`}>
          <Barras dias={datos.dias.map((d) => ({ etiqueta: d.etiqueta, valor: d.tareas }))} formato={(v) => `${v} ${v === 1 ? 'tarea' : 'tareas'}`} color="var(--color-violeta)" />
        </Bloque>
        <Bloque titulo="Gasto de IA por día" subtitulo={`Últimos ${DIAS} días, en dólares`}>
          <Barras dias={datos.dias.map((d) => ({ etiqueta: d.etiqueta, valor: d.gasto }))} formato={(v) => `$${v.toFixed(2)}`} color="var(--color-tinta)" />
        </Bloque>
      </div>

      {/* Por empleado */}
      <Bloque titulo="Rendimiento por empleado" subtitulo="Tareas completadas desde siempre; gasto de este mes" className="mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-tinta-suave">
              <th className="pb-2 font-semibold">Empleado</th>
              <th className="pb-2 font-semibold">Completadas</th>
              <th className="pb-2 text-right font-semibold">Abiertas</th>
              <th className="pb-2 text-right font-semibold">A la primera</th>
              <th className="pb-2 text-right font-semibold">Gasto</th>
            </tr>
          </thead>
          <tbody>
            {datos.porEmpleado.map(({ agente, hechas, abiertas, primera, gasto }) => {
              const max = Math.max(1, ...datos.porEmpleado.map((e) => e.hechas))
              return (
                <tr key={agente.id} className="border-t border-linea">
                  <td className="py-2">
                    <span className="flex items-center gap-2 font-semibold text-tinta">
                      <Avatar nombre={agente.nombre} color={agente.color} foto={agente.skin_avatar} tam={28} />
                      {agente.nombre}
                    </span>
                  </td>
                  <td className="w-[38%] py-2">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 rounded-r bg-violeta" style={{ width: `${(hechas / max) * 100}%`, minWidth: hechas ? 4 : 0 }} />
                      <span className="text-xs font-semibold text-tinta tabular-nums">{hechas}</span>
                    </span>
                  </td>
                  <td className="py-2 text-right text-tinta tabular-nums">{abiertas}</td>
                  <td className="py-2 text-right text-tinta tabular-nums">{primera === null ? '—' : `${primera}%`}</td>
                  <td className="py-2 text-right text-tinta tabular-nums">${gasto.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {datos.apoyo.length > 0 && (
          <p className="mt-3 text-xs text-tinta-suave">
            Además, este mes: {datos.apoyo.map((a) => `${a.agente.nombre} $${a.gasto.toFixed(2)}`).join(' · ')} (atender chats y revisar trabajos).
          </p>
        )}
      </Bloque>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* Por cliente */}
        <Bloque titulo="Trabajo por cliente" subtitulo="Tareas totales; en violeta las completadas">
          <div className="space-y-2.5">
            {datos.porCliente.map(({ cliente, total, hechas, abiertas }) => {
              const max = Math.max(1, ...datos.porCliente.map((c) => c.total))
              return (
                <div key={cliente.id} title={`${hechas} completadas · ${abiertas} abiertas`}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-tinta">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: cliente.color }} />
                      {cliente.nombre}
                    </span>
                    <span className="text-tinta-suave tabular-nums">
                      {hechas} de {total}
                    </span>
                  </div>
                  <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-suave" style={{ width: `${(total / max) * 100}%`, minWidth: total ? 8 : 0 }}>
                    <span className="h-full bg-violeta" style={{ width: total ? `${(hechas / total) * 100}%` : 0 }} />
                    <span className="h-full flex-1 bg-violeta/25" />
                  </div>
                </div>
              )
            })}
          </div>
        </Bloque>

        {/* Acciones de la bandeja */}
        <Bloque titulo="Acciones de la bandeja" subtitulo="Todo lo que los agentes propusieron hacer fuera">
          <Apilada partes={datos.acciones} />
          <ul className="mt-4 space-y-1.5 text-sm">
            {datos.acciones.map((a) => (
              <li key={a.estado} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-tinta">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                  {a.texto}
                </span>
                <span className="font-semibold text-tinta tabular-nums">{a.cantidad}</span>
              </li>
            ))}
          </ul>
        </Bloque>
      </div>
    </Pantalla>
  )
}

function duracion(minutos: number): string {
  if (minutos < 60) return `${Math.max(1, Math.round(minutos))} min`
  if (minutos < 60 * 24) return `${(minutos / 60).toFixed(1)} h`
  return `${(minutos / 60 / 24).toFixed(1)} días`
}

function Cifra({ valor, texto, detalle }: { valor: string; texto: string; detalle: string }) {
  return (
    <div className="rounded-2xl border border-linea bg-tarjeta p-4">
      <p className="text-xs font-semibold text-tinta-suave">{texto}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-tinta tabular-nums">{valor}</p>
      <p className="mt-1 text-xs text-tinta-suave">{detalle}</p>
    </div>
  )
}

function Bloque({ titulo, subtitulo, className = '', children }: { titulo: string; subtitulo: string; className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-linea bg-tarjeta p-4 ${className}`}>
      <h3 className="text-sm font-bold text-tinta">{titulo}</h3>
      <p className="mb-3 text-xs text-tinta-suave">{subtitulo}</p>
      {children}
    </section>
  )
}

// Barras verticales finas con ayuda al pasar el ratón (una sola serie, una sola escala)
function Barras({ dias, formato, color }: { dias: { etiqueta: string; valor: number }[]; formato: (v: number) => string; color: string }) {
  const [encima, setEncima] = useState<number | null>(null)
  const max = Math.max(...dias.map((d) => d.valor))
  const alto = 120
  if (max === 0) return <p className="flex h-[148px] items-center justify-center text-sm text-tinta-suave">Aún no hay datos en estos días.</p>
  return (
    <div className="relative">
      <div className="flex items-end gap-1 border-b border-linea" style={{ height: alto }}>
        {dias.map((d, i) => (
          <div key={i} className="relative flex h-full flex-1 items-end justify-center" onMouseEnter={() => setEncima(i)} onMouseLeave={() => setEncima(null)}>
            <span
              className="w-full max-w-[14px] rounded-t transition-opacity"
              style={{ height: `${(d.valor / max) * 100}%`, minHeight: d.valor ? 3 : 0, background: color, opacity: encima === null || encima === i ? 1 : 0.35 }}
            />
            {encima === i && (
              <span className="absolute bottom-full z-10 mb-1 rounded-lg bg-barra px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-white shadow-lg">
                {d.etiqueta}: {formato(d.valor)}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-tinta-suave">
        <span>{dias[0].etiqueta}</span>
        <span>Máx. {formato(max)}</span>
        <span>{dias[dias.length - 1].etiqueta}</span>
      </div>
    </div>
  )
}

// Barra apilada horizontal con 2 px de separación entre partes
function Apilada({ partes }: { partes: { texto: string; color: string; cantidad: number }[] }) {
  const total = partes.reduce((s, p) => s + p.cantidad, 0)
  if (!total) return <p className="text-sm text-tinta-suave">Todavía no hay acciones.</p>
  return (
    <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
      {partes
        .filter((p) => p.cantidad)
        .map((p) => (
          <span key={p.texto} title={`${p.texto}: ${p.cantidad}`} className="h-full" style={{ width: `${(p.cantidad / total) * 100}%`, background: p.color }} />
        ))}
    </div>
  )
}

