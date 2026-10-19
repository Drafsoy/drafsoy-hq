import { clientesDeAgente, usarDatos } from '@/datos/DatosProvider'
import { ESTADOS_AGENTE, TAREA_ABIERTA } from '@/datos/tipos'
import { usarRuta } from '@/navegacion'
import { Subtitulo } from './ui'

// Panel flotante a la izquierda: nuevo trabajo, clientes y equipo.
export default function BarraLateral() {
  const datos = usarDatos()
  const { clientes, agentes, tareas } = datos
  const { ir } = usarRuta()

  return (
    <aside className="panel-juego entrar-izquierda absolute z-40 top-4 bottom-4 left-4 flex w-[280px] flex-col gap-4 overflow-y-auto p-4">
      <h1 className="titulo-juego text-center text-4xl leading-none text-oro">
        Drafsoy <span className="text-white">HQ</span>
      </h1>

      <button
        onClick={() => ir({ pantalla: 'chat' })}
        className="titulo-juego rounded-xl border-[3px] border-b-[6px] border-yellow-700 bg-gradient-to-b from-yellow-200 to-oro py-3 text-xl text-noche uppercase shadow-[0_0_24px_rgba(255,201,60,0.55)] transition hover:scale-[1.03] active:translate-y-0.5 active:border-b-[3px]"
      >
        + Nuevo trabajo
      </button>

      <section>
        <div className="flex items-center justify-between">
          <Subtitulo>Clientes</Subtitulo>
          <button onClick={() => ir({ pantalla: 'nuevoCliente' })} className="mb-2 rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-black hover:bg-vida hover:text-noche">
            + Cliente
          </button>
        </div>
        <ul className="space-y-1.5">
          {clientes.map((cliente) => {
            const abiertas = tareas.filter((t) => t.cliente_id === cliente.id && TAREA_ABIERTA(t)).length
            return (
              <li key={cliente.id}>
                <button
                  onClick={() => ir({ pantalla: 'cliente', id: cliente.id })}
                  className="flex w-full items-center gap-2 overflow-hidden rounded-lg border-2 border-white/10 bg-black/30 text-left text-sm font-black transition hover:translate-x-1 hover:border-white/50"
                >
                  <span className="titulo-juego flex h-9 w-9 shrink-0 items-center justify-center text-lg text-white" style={{ background: cliente.color }}>
                    {cliente.nombre.charAt(0)}
                  </span>
                  <span className="flex-1 truncate">{cliente.nombre}</span>
                  {abiertas > 0 && <span className="titulo-juego mr-2 rounded-md bg-oro px-2 text-sm text-noche">{abiertas}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <Subtitulo>Equipo</Subtitulo>
          <button onClick={() => ir({ pantalla: 'nuevoAgente' })} className="mb-2 rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-black hover:bg-oro hover:text-noche">
            + Contratar
          </button>
        </div>
        <ul className="space-y-1">
          {agentes.map((agente) => {
            const estado = ESTADOS_AGENTE[agente.estado]
            const cuentas = clientesDeAgente(datos, agente.id)
            return (
              <li key={agente.id}>
                <button
                  onClick={() => ir({ pantalla: 'agente', id: agente.id })}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/10"
                >
                  {/* Mini avatar: cabeza LEGO amarilla sobre el color del agente */}
                  <span className="relative flex h-9 w-8 shrink-0 flex-col items-center">
                    <span className="h-4 w-4 rounded-sm border border-black/40 bg-[#ffd23f]" />
                    <span className="h-4 w-7 rounded-t-md border border-black/40" style={{ background: agente.color }} />
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-noche" style={{ background: estado.color }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black">{agente.nombre}</span>
                    <span className="flex items-center gap-1 truncate text-xs text-white/60">
                      {agente.es_recepcionista ? (
                        agente.rol
                      ) : cuentas.length === 0 ? (
                        'Sin cuentas'
                      ) : (
                        <>
                          {cuentas.map((c) => (
                            <span key={c.id} title={c.nombre} className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                          ))}
                          <span className="ml-0.5">
                            {cuentas.length} {cuentas.length === 1 ? 'cuenta' : 'cuentas'}
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-black uppercase" style={{ color: estado.color }}>
                    {estado.texto}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </aside>
  )
}
