import { supabase } from '@/datos/supabase'
import { clientesDeAgente, usarDatos } from '@/datos/DatosProvider'
import { ESTADOS_AGENTE, TAREA_ABIERTA } from '@/datos/tipos'
import FormularioAgente from '@/componentes/FormularioAgente'
import { Etiqueta, Pantalla, Tarjeta, Titulo, Vacio } from '@/componentes/ui'

export default function FichaAgente({ id }: { id: string }) {
  const datos = usarDatos()
  const { agentes, tareas, gastos, asignaciones } = datos
  const agente = agentes.find((a) => a.id === id)
  if (!agente) return <Pantalla><Vacio texto="Este agente no existe." /></Pantalla>

  const cuentas = clientesDeAgente(datos, id)
  const abiertas = tareas.filter((t) => t.agente_id === id && TAREA_ABIERTA(t)).length
  const hechas = tareas.filter((t) => t.agente_id === id && t.estado === 'completada').length
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)
  const gastoMes = gastos
    .filter((g) => g.agente_id === id && new Date(g.creado_en) >= inicioMes)
    .reduce((s, g) => s + Number(g.costo_usd), 0)

  return (
    <Pantalla>
      <div className="mb-6 flex items-center gap-5">
        <span className="h-20 w-16 rounded-xl border-4 border-black/40" style={{ background: agente.color }} />
        <div className="flex-1">
          <Titulo>{agente.nombre}</Titulo>
          <p className="text-white/60">
            {agente.rol}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {cuentas.map((c) => (
              <Etiqueta key={c.id} texto={c.nombre} color={c.color} />
            ))}
          </div>
        </div>
        <Etiqueta {...ESTADOS_AGENTE[agente.estado]} />
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3">
        <Dato valor={abiertas} texto="Tareas abiertas" />
        <Dato valor={hechas} texto="Completadas" />
        <Dato valor={`$${gastoMes.toFixed(2)} / $${Number(agente.tope_gasto_usd).toFixed(0)}`} texto="Gasto este mes" />
      </div>

      {/* key: si cambias de agente, el formulario se reinicia con sus datos */}
      <FormularioAgente
        key={agente.id}
        inicial={agente}
        textoBoton="Guardar cambios"
        cuentasIniciales={cuentas.map((c) => c.id)}
        alGuardar={async (cambios, nuevasCuentas) => {
          const { error } = await supabase.from('agentes').update(cambios).eq('id', agente.id)
          if (error) return error.message
          // Sincroniza las cuentas que lleva: añade las nuevas y quita las desmarcadas
          const actuales = asignaciones.filter((a) => a.agente_id === agente.id)
          const quitar = actuales.filter((a) => !nuevasCuentas.includes(a.cliente_id)).map((a) => a.id)
          const anadir = nuevasCuentas.filter((c) => !actuales.some((a) => a.cliente_id === c))
          if (quitar.length) {
            const r = await supabase.from('agente_clientes').delete().in('id', quitar)
            if (r.error) return r.error.message
          }
          if (anadir.length) {
            const r = await supabase.from('agente_clientes').insert(anadir.map((cliente_id) => ({ agente_id: agente.id, cliente_id })))
            if (r.error) return r.error.message
          }
          return null
        }}
      />
    </Pantalla>
  )
}

function Dato({ valor, texto }: { valor: string | number; texto: string }) {
  return (
    <Tarjeta className="text-center">
      <p className="titulo-juego text-3xl text-oro">{valor}</p>
      <p className="text-xs font-black tracking-widest text-white/50 uppercase">{texto}</p>
    </Tarjeta>
  )
}
