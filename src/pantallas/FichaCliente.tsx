import { useState, type FormEvent } from 'react'
import { supabase } from '@/datos/supabase'
import { agentesDeCliente, usarDatos } from '@/datos/DatosProvider'
import { ESTADOS_AGENTE, ESTADOS_TAREA, PRIORIDADES, type EstadoTarea, type Tarea } from '@/datos/tipos'
import { usarRuta } from '@/navegacion'
import { Boton, Etiqueta, Pantalla, Subtitulo, Tarjeta, Titulo, Vacio, claseCampo } from '@/componentes/ui'

// Supabase solo envía el cambio cuando se espera su respuesta (.then); si falla, se avisa
const avisarError = ({ error }: { error: { message: string } | null }) => {
  if (error) alert(`No se pudo guardar: ${error.message}`)
}

const COLUMNAS: { titulo: string; estados: EstadoTarea[] }[] = [
  { titulo: 'Pendientes', estados: ['pendiente'] },
  { titulo: 'En progreso', estados: ['en_progreso'] },
  { titulo: 'Te necesitan', estados: ['te_necesita', 'esperando_aprobacion'] },
  { titulo: 'Completadas', estados: ['completada'] }
]

// Ficha de una cuenta (cliente) de la agencia
export default function FichaCliente({ id }: { id: string }) {
  const datos = usarDatos()
  const { clientes, agentes, asignaciones, tareas, memoria } = datos
  const { ir } = usarRuta()
  const cliente = clientes.find((c) => c.id === id)
  if (!cliente) return <Pantalla><Vacio texto="Este cliente no existe." /></Pantalla>

  const equipo = agentesDeCliente(datos, id)
  const sinCuenta = agentes.filter((a) => !a.es_recepcionista && !equipo.some((e) => e.id === a.id))
  // Lo más reciente arriba
  const tareasCliente = tareas.filter((t) => t.cliente_id === id).sort((a, b) => b.creado_en.localeCompare(a.creado_en))
  const memoriaCliente = memoria.filter((m) => m.cliente_id === id)

  const quitar = (agenteId: string) => {
    const fila = asignaciones.find((a) => a.agente_id === agenteId && a.cliente_id === id)
    if (fila) supabase.from('agente_clientes').delete().eq('id', fila.id).then(avisarError)
  }

  return (
    <Pantalla>
      <div className="mb-6 flex items-center gap-4 pr-12">
        <span className="h-12 w-12 rounded-xl border-4 border-linea" style={{ background: cliente.color }} />
        <div>
          <Titulo color={cliente.color}>{cliente.nombre}</Titulo>
          <p className="text-tinta-suave">{cliente.descripcion ?? 'Cuenta de la agencia'}</p>
        </div>
      </div>

      <Subtitulo>Equipo que lleva la cuenta</Subtitulo>
      <div className="mb-3 flex flex-wrap gap-3">
        {equipo.length === 0 && <Vacio texto="Nadie lleva esta cuenta todavía." />}
        {equipo.map((a) => (
          <Tarjeta key={a.id} className="flex w-64 items-center gap-3">
            <button onClick={() => ir({ pantalla: 'agente', id: a.id })} className="flex flex-1 items-center gap-3 text-left">
              <span className="h-12 w-10 rounded-md border-4 border-linea" style={{ background: a.color }} />
              <span className="flex-1">
                <span className="block text-xl">{a.nombre}</span>
                <Etiqueta {...ESTADOS_AGENTE[a.estado]} />
              </span>
            </button>
            <button onClick={() => quitar(a.id)} title="Quitar de esta cuenta" className="text-xs text-tinta-suave/70 hover:text-alerta">
              ✕
            </button>
          </Tarjeta>
        ))}
      </div>
      {sinCuenta.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && supabase.from('agente_clientes').insert({ agente_id: e.target.value, cliente_id: id }).then(avisarError)}
          className={`${claseCampo} mb-8 w-64 text-sm`}
        >
          <option value="">+ Asignar empleado…</option>
          {sinCuenta.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre} ({a.rol})
            </option>
          ))}
        </select>
      )}

      <div className="mt-4 flex items-center justify-between">
        <Subtitulo>Tareas</Subtitulo>
        {/* Para probar el paracaídas y el cofre antes de tener la recepcionista (Paso 5) */}
        <button
          onClick={() =>
            supabase.from('tareas').insert({ titulo: 'Tarea de prueba', cliente_id: id, agente_id: equipo[0]?.id ?? null, prioridad: 'media' }).then(avisarError)
          }
          className="mb-2 text-xs font-bold text-tinta-suave hover:text-violeta"
        >
          + Tarea de prueba 🪂
        </button>
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3">
        {COLUMNAS.map((col) => {
          const lista = tareasCliente.filter((t) => col.estados.includes(t.estado))
          return (
            <div key={col.titulo} className="rounded-2xl bg-suave p-3">
              <p className="mb-2 text-lg">
                {col.titulo} <span className="text-tinta-suave/70">{lista.length}</span>
              </p>
              <div className="space-y-2">
                {lista.map((t) => (
                  <TarjetaTarea key={t.id} tarea={t} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <Subtitulo>Memoria del cliente</Subtitulo>
      <p className="mb-3 text-sm text-tinta-suave">Lo que el equipo debe saber siempre de este cliente: tono, público, ofertas, prohibiciones…</p>
      <div className="mb-3 space-y-2">
        {memoriaCliente.length === 0 && <Vacio texto="Sin memoria todavía." />}
        {memoriaCliente.map((m) => (
          <Tarjeta key={m.id} className="flex items-start gap-3">
            <div className="flex-1">
              <p className="font-bold text-violeta">{m.clave}</p>
              <p className="text-sm whitespace-pre-wrap">{m.contenido}</p>
            </div>
            <button onClick={() => supabase.from('memoria_cliente').delete().eq('id', m.id).then(avisarError)} className="text-xs text-tinta-suave/70 hover:text-alerta">
              Borrar
            </button>
          </Tarjeta>
        ))}
      </div>
      <NuevaMemoria clienteId={id} />
    </Pantalla>
  )
}

function TarjetaTarea({ tarea }: { tarea: Tarea }) {
  const { agentes } = usarDatos()
  const agente = agentes.find((a) => a.id === tarea.agente_id)
  return (
    <div className="rounded-xl border-2 border-linea bg-suave p-3 text-sm">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="font-bold">{tarea.titulo}</p>
        <Etiqueta {...PRIORIDADES[tarea.prioridad]} />
      </div>
      <p className="text-xs text-tinta-suave">
        {agente ? agente.nombre : 'Sin asignar'}
        {tarea.fecha_limite ? ` · vence ${new Date(tarea.fecha_limite + 'T00:00').toLocaleDateString('es')}` : ''}
      </p>
      {tarea.revision && (
        <p className={`mt-2 rounded-lg px-2 py-1 text-xs whitespace-pre-wrap ${tarea.revision.startsWith('✅') ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-800'}`}>
          {tarea.revision}
        </p>
      )}
      {tarea.resultado && (
        <details className="mt-2 rounded-lg bg-suave px-2 py-1">
          <summary className="cursor-pointer text-xs font-bold text-violeta">📄 Ver entregable</summary>
          <p className="mt-1 max-h-64 overflow-y-auto text-xs whitespace-pre-wrap text-tinta/80 select-text">{tarea.resultado}</p>
        </details>
      )}
      <select
        value={tarea.estado}
        onChange={(e) => supabase.from('tareas').update({ estado: e.target.value }).eq('id', tarea.id).then(avisarError)}
        className="mt-2 w-full rounded-lg bg-suave px-2 py-1 text-xs font-bold"
      >
        {Object.entries(ESTADOS_TAREA).map(([valor, { texto }]) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>
    </div>
  )
}

function NuevaMemoria({ clienteId }: { clienteId: string }) {
  const [clave, setClave] = useState('')
  const [contenido, setContenido] = useState('')

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('memoria_cliente').insert({ cliente_id: clienteId, clave, contenido })
    if (!error) {
      setClave('')
      setContenido('')
    }
  }

  return (
    <form onSubmit={guardar} className="flex gap-2">
      <input required value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Tema (p. ej. Tono de marca)" className={`${claseCampo} w-56`} />
      <input required value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder="Lo que hay que recordar" className={claseCampo} />
      <Boton type="submit">Guardar</Boton>
    </form>
  )
}
