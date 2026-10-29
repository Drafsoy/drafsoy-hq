import { useState } from 'react'
import { supabase } from '@/datos/supabase'
import { clientesDeAgente, usarDatos } from '@/datos/DatosProvider'
import { ESTADOS_AGENTE, TAREA_ABIERTA, type Agente, type Tarea } from '@/datos/tipos'
import FormularioAgente from '@/componentes/FormularioAgente'
import ChatRecepcion from './ChatRecepcion'
import { TarjetaTarea } from './FichaCliente'
import { Avatar, Boton, Etiqueta, Pantalla, Subtitulo, Tarjeta, Titulo, Vacio, claseCampo } from '@/componentes/ui'

type Pestana = 'chat' | 'tareas' | 'info'

// Ficha del empleado en tres pestañas: primero el chat; luego sus tareas; y su información (cifras y configuración)
export default function FichaAgente({ id }: { id: string }) {
  const datos = usarDatos()
  const { agentes, tareas, gastos, asignaciones } = datos
  const [pestana, setPestana] = useState<Pestana>('chat')
  const agente = agentes.find((a) => a.id === id)
  if (!agente) return <Pantalla><Vacio texto="Este agente no existe." /></Pantalla>

  const cuentas = clientesDeAgente(datos, id)
  const suyas = tareas.filter((t) => t.agente_id === id).sort((a, b) => b.actualizado_en.localeCompare(a.actualizado_en))
  const teNecesitan = suyas.filter((t) => t.estado === 'te_necesita')
  const enCurso = suyas.filter((t) => t.estado === 'en_progreso' || t.estado === 'esperando_aprobacion')
  const pendientes = suyas.filter((t) => t.estado === 'pendiente')
  const hechas = suyas.filter((t) => t.estado === 'completada')
  const abiertas = suyas.filter(TAREA_ABIERTA).length
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)
  const gastoMes = gastos
    .filter((g) => g.agente_id === id && new Date(g.creado_en) >= inicioMes)
    .reduce((s, g) => s + Number(g.costo_usd), 0)

  const pestanas: { id: Pestana; texto: string; aviso?: number }[] = [
    { id: 'chat', texto: 'Chat' },
    { id: 'tareas', texto: 'Tareas', aviso: teNecesitan.length },
    { id: 'info', texto: 'Información' }
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Cabecera fija: quién es y cómo está */}
      <div className="px-6 pt-6 pr-16">
        <div className="flex items-center gap-4">
          <Avatar nombre={agente.nombre} color={agente.color} foto={agente.skin_avatar} tam={64} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Titulo>{agente.nombre}</Titulo>
              <Etiqueta {...ESTADOS_AGENTE[agente.estado]} />
            </div>
            <p className="text-sm text-tinta-suave">{agente.rol}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {cuentas.map((c) => (
                <Etiqueta key={c.id} texto={c.nombre} color={c.color} />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-1 border-b border-linea">
          {pestanas.map((p) => (
            <button
              key={p.id}
              onClick={() => setPestana(p.id)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-semibold transition ${
                pestana === p.id ? 'border-tinta text-tinta' : 'border-transparent text-tinta-suave hover:text-tinta'
              }`}
            >
              {p.texto}
              {!!p.aviso && <span className="rounded-full bg-alerta px-1.5 text-[11px] font-bold text-white">{p.aviso}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {pestana === 'chat' && <ChatRecepcion key={agente.id} agenteId={agente.es_recepcionista ? undefined : agente.id} embebido />}

        {pestana === 'tareas' && (
          <Pantalla>
            {teNecesitan.length > 0 && (
              <div className="mb-6">
                <Subtitulo>❗ Te necesita para esto</Subtitulo>
                <div className="flex flex-col gap-3">
                  {teNecesitan.map((t) => (
                    <TareaParaRafa key={t.id} tarea={t} agente={agente} otrasPendientes={teNecesitan.length - 1} />
                  ))}
                </div>
              </div>
            )}
            <Grupo titulo="Trabajando ahora" vacio="No está trabajando en nada ahora mismo." lista={enCurso} />
            <Grupo titulo="Por hacer" vacio="No tiene tareas pendientes." lista={pendientes} />
            <Grupo titulo="Completadas" vacio="Aún no ha completado tareas." lista={hechas.slice(0, 20)} />
          </Pantalla>
        )}

        {pestana === 'info' && (
          <Pantalla>
            <div className="mb-6 grid grid-cols-3 gap-3">
              <Dato valor={abiertas} texto="Tareas abiertas" />
              <Dato valor={hechas.length} texto="Completadas" />
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
        )}
      </div>
    </div>
  )
}

// Un grupo de tareas plegadas (solo el título; la flecha despliega el resto)
function Grupo({ titulo, vacio, lista }: { titulo: string; vacio: string; lista: Tarea[] }) {
  return (
    <div className="mb-6">
      <Subtitulo>
        {titulo} · {lista.length}
      </Subtitulo>
      {lista.length === 0 ? (
        <p className="text-sm text-tinta-suave">{vacio}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((t) => (
            <TarjetaTarea key={t.id} tarea={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function Dato({ valor, texto }: { valor: string | number; texto: string }) {
  return (
    <Tarjeta className="text-center">
      <p className="text-3xl font-bold tracking-tight text-tinta">{valor}</p>
      <p className="text-xs font-bold tracking-widest text-tinta-suave uppercase">{texto}</p>
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
      {tarea.revision && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm whitespace-pre-wrap text-amber-800 select-text">{tarea.revision}</p>}
      {tarea.resultado && (
        <details className="mt-2 rounded-lg bg-suave px-3 py-2">
          <summary className="cursor-pointer text-sm font-bold text-violeta">📄 Ver entregable</summary>
          <p className="mt-1 max-h-72 overflow-y-auto text-sm whitespace-pre-wrap text-tinta/80 select-text">{tarea.resultado}</p>
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
