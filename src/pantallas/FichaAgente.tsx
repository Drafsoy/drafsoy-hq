import { useState } from 'react'
import { supabase } from '@/datos/supabase'
import { clientesDeAgente, usarDatos } from '@/datos/DatosProvider'
import { ESTADOS_AGENTE, TAREA_ABIERTA, type Agente, type Tarea } from '@/datos/tipos'
import FormularioAgente from '@/componentes/FormularioAgente'
import { Boton, Etiqueta, Pantalla, Subtitulo, Tarjeta, Titulo, Vacio, claseCampo } from '@/componentes/ui'

export default function FichaAgente({ id }: { id: string }) {
  const datos = usarDatos()
  const { agentes, tareas, gastos, asignaciones } = datos
  const agente = agentes.find((a) => a.id === id)
  if (!agente) return <Pantalla><Vacio texto="Este agente no existe." /></Pantalla>

  const cuentas = clientesDeAgente(datos, id)
  const abiertas = tareas.filter((t) => t.agente_id === id && TAREA_ABIERTA(t)).length
  const teNecesitan = tareas.filter((t) => t.agente_id === id && t.estado === 'te_necesita')
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

      {teNecesitan.length > 0 && (
        <div className="mb-8">
          <Subtitulo>❗ Te necesita para esto</Subtitulo>
          <div className="flex flex-col gap-3">
            {teNecesitan.map((t) => (
              <TareaParaRafa key={t.id} tarea={t} agente={agente} otrasPendientes={teNecesitan.length - 1} />
            ))}
          </div>
        </div>
      )}

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

// Una tarea atascada: Rafa ve el motivo y decide (que la corrija con sus indicaciones o darla por terminada)
function TareaParaRafa({ tarea, agente, otrasPendientes }: { tarea: Tarea; agente: Agente; otrasPendientes: number }) {
  const [respuesta, setRespuesta] = useState('')
  const [enviando, setEnviando] = useState(false)

  const decidir = async (corregir: boolean) => {
    setEnviando(true)
    const indicacion = respuesta.trim() || 'Aplica las correcciones de la revisión.'
    const { error } = await supabase
      .from('tareas')
      .update(
        corregir
          ? // Vuelve a su cola con intentos a cero y la indicación de Rafa al final de la revisión
            { estado: 'pendiente', intentos: 0, revision: `${tarea.revision ?? ''}

🗣️ Rafa: ${indicacion}`.trim() }
          : { estado: 'completada' }
      )
      .eq('id', tarea.id)
    if (!error && otrasPendientes === 0) await supabase.from('agentes').update({ estado: 'disponible' }).eq('id', agente.id)
    setEnviando(false)
    if (error) alert(`No se pudo guardar: ${error.message}`)
  }

  return (
    <Tarjeta>
      <p className="mb-2 font-bold">{tarea.titulo}</p>
      {tarea.revision && <p className="rounded-lg bg-oro/15 px-3 py-2 text-sm whitespace-pre-wrap text-oro select-text">{tarea.revision}</p>}
      {tarea.resultado && (
        <details className="mt-2 rounded-lg bg-black/30 px-3 py-2">
          <summary className="cursor-pointer text-sm font-black text-sky-300">📄 Ver entregable</summary>
          <p className="mt-1 max-h-72 overflow-y-auto text-sm whitespace-pre-wrap text-white/85 select-text">{tarea.resultado}</p>
        </details>
      )}
      <textarea
        value={respuesta}
        onChange={(e) => setRespuesta(e.target.value)}
        rows={2}
        placeholder={`Dile a ${agente.nombre} qué hacer (si lo dejas vacío, aplicará las correcciones de la revisión)`}
        className={`${claseCampo} mt-3`}
      />
      <div className="mt-2 flex gap-2">
        <Boton variante="verde" disabled={enviando} onClick={() => decidir(true)}>
          Que lo corrija
        </Boton>
        <Boton variante="gris" disabled={enviando} onClick={() => decidir(false)}>
          Darla por terminada
        </Boton>
      </div>
    </Tarjeta>
  )
}
