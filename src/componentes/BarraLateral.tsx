import type { ReactNode } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { clientesDeAgente, usarDatos } from '@/datos/DatosProvider'
import { ESTADOS_AGENTE, TAREA_ABIERTA } from '@/datos/tipos'
import { usarRuta } from '@/navegacion'
import BarraEscudo from './BarraEscudo'
import { Avatar, LogoCliente } from './ui'

// Columna derecha del dashboard: lo que te necesita, el equipo, los clientes y el presupuesto de IA.
export default function BarraLateral() {
  const datos = usarDatos()
  const { clientes, agentes, tareas, aprobaciones } = datos
  const { ir } = usarRuta()

  const porAprobar = aprobaciones.filter((a) => a.estado === 'pendiente').length
  const teNecesitan = tareas.filter((t) => t.estado === 'te_necesita')

  return (
    <aside className="entrar-derecha flex w-[340px] shrink-0 flex-col gap-4 overflow-y-auto">
      {/* Te necesitan */}
      <Seccion titulo="Te necesitan" contador={porAprobar + teNecesitan.length}>
        {porAprobar === 0 && teNecesitan.length === 0 ? (
          <p className="rounded-2xl bg-suave px-4 py-3 text-sm text-tinta-suave">Todo en orden ✨ Nadie te está esperando.</p>
        ) : (
          <div className="space-y-2">
            {porAprobar > 0 && (
              <Fila
                alPulsar={() => ir({ pantalla: 'bandeja' })}
                icono={<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-lg">📥</span>}
                titulo={`${porAprobar} ${porAprobar === 1 ? 'acción por aprobar' : 'acciones por aprobar'}`}
                detalle="Revisadas por Rafa IA, esperan tu sí"
              />
            )}
            {teNecesitan.map((t) => {
              const agente = agentes.find((a) => a.id === t.agente_id)
              return (
                <Fila
                  key={t.id}
                  alPulsar={() => agente && ir({ pantalla: 'agente', id: agente.id })}
                  icono={<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-lg">❗</span>}
                  titulo={t.titulo}
                  detalle={agente ? `${agente.nombre} necesita tu criterio` : 'Necesita tu criterio'}
                />
              )
            })}
          </div>
        )}
      </Seccion>

      {/* Equipo */}
      <Seccion titulo="Equipo" accion={{ texto: 'Contratar', alPulsar: () => ir({ pantalla: 'nuevoAgente' }) }}>
        <div className="space-y-1">
          {agentes.map((agente) => {
            const estado = ESTADOS_AGENTE[agente.estado]
            const cuentas = clientesDeAgente(datos, agente.id)
            return (
              <Fila
                key={agente.id}
                alPulsar={() => ir({ pantalla: 'agente', id: agente.id })}
                icono={
                  <span className="relative">
                    <Avatar nombre={agente.nombre} color={agente.color} foto={agente.skin_avatar} />
                    <span className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white" style={{ background: estado.color }} />
                  </span>
                }
                titulo={agente.nombre}
                detalle={agente.es_recepcionista || agente.es_supervisor ? agente.rol : `${agente.rol} · ${cuentas.length} ${cuentas.length === 1 ? 'cuenta' : 'cuentas'}`}
                derecha={<span className="text-[11px] font-semibold" style={{ color: estado.color === '#cbd5e1' ? 'var(--color-tinta-suave)' : estado.color }}>{estado.texto}</span>}
              />
            )
          })}
        </div>
      </Seccion>

      {/* Clientes */}
      <Seccion titulo="Clientes" accion={{ texto: 'Cliente', alPulsar: () => ir({ pantalla: 'nuevoCliente' }) }}>
        <div className="space-y-1">
          {clientes.map((cliente) => {
            const abiertas = tareas.filter((t) => t.cliente_id === cliente.id && TAREA_ABIERTA(t)).length
            return (
              <Fila
                key={cliente.id}
                alPulsar={() => ir({ pantalla: 'cliente', id: cliente.id })}
                icono={
                  <LogoCliente nombre={cliente.nombre} color={cliente.color} logo={cliente.logo} />
                }
                titulo={cliente.nombre}
                detalle={abiertas === 0 ? 'Sin tareas abiertas' : `${abiertas} ${abiertas === 1 ? 'tarea abierta' : 'tareas abiertas'}`}
              />
            )
          })}
        </div>
      </Seccion>

      {/* Presupuesto de IA */}
      <div className="rounded-3xl bg-barra p-5 text-white">
        <BarraEscudo />
      </div>
    </aside>
  )
}

function Seccion({ titulo, contador, accion, children }: { titulo: string; contador?: number; accion?: { texto: string; alPulsar: () => void }; children: ReactNode }) {
  return (
    <section className="tarjeta p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-bold text-tinta">
          {titulo}
          {!!contador && <span className="rounded-full bg-alerta px-2 py-0.5 text-[11px] font-bold text-white">{contador}</span>}
        </h3>
        {accion && (
          <button onClick={accion.alPulsar} className="flex items-center gap-1 rounded-full bg-lima px-3 py-1 text-xs font-semibold text-tinta transition hover:brightness-95">
            <Plus size={14} /> {accion.texto}
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

function Fila({ icono, titulo, detalle, derecha, alPulsar }: { icono: ReactNode; titulo: string; detalle: string; derecha?: ReactNode; alPulsar: () => void }) {
  return (
    <button onClick={alPulsar} className="group flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-suave">
      {icono}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-tinta">{titulo}</span>
        <span className="block truncate text-xs text-tinta-suave">{detalle}</span>
      </span>
      {derecha ?? <ChevronRight size={16} className="text-tinta-suave opacity-0 transition group-hover:opacity-100" />}
    </button>
  )
}
