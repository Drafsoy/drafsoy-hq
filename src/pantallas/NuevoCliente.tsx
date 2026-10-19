import { useState, type FormEvent } from 'react'
import { supabase } from '@/datos/supabase'
import { usarDatos } from '@/datos/DatosProvider'
import { usarRuta } from '@/navegacion'
import { Boton, Pantalla, Subtitulo, Titulo, claseCampo } from '@/componentes/ui'

const COLORES = ['#ff5a6e', '#ff9f40', '#ffc93c', '#5ad15a', '#3fb6ff', '#a15cff', '#e64980', '#20c997']

// Dar de alta una cuenta nueva en la agencia
export default function NuevoCliente() {
  const { agentes } = usarDatos()
  const { ir } = usarRuta()
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [color, setColor] = useState(COLORES[4])
  const [equipo, setEquipo] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const empleados = agentes.filter((a) => !a.es_recepcionista && !a.es_supervisor)

  async function crear(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const { data, error } = await supabase
      .from('clientes')
      .insert({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, color })
      .select('id')
      .single()
    if (error) return setError(error.message)
    if (equipo.length) await supabase.from('agente_clientes').insert(equipo.map((agente_id) => ({ agente_id, cliente_id: data.id })))
    ir({ pantalla: 'cliente', id: data.id })
  }

  return (
    <Pantalla>
      <div className="mb-5 pr-12">
        <Titulo color="#5ad15a">Nuevo cliente</Titulo>
        <p className="text-white/70">Una cuenta nueva para la agencia. Luego podrás guardar su memoria (tono, público, ofertas…).</p>
      </div>
      <form onSubmit={crear} className="space-y-4">
        <label className="block">
          <Subtitulo>Nombre</Subtitulo>
          <input required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la marca" className={claseCampo} />
        </label>
        <label className="block">
          <Subtitulo>Descripción</Subtitulo>
          <textarea rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="A qué se dedica, qué vende, a quién…" className={claseCampo} />
        </label>
        <div>
          <Subtitulo>Color</Subtitulo>
          <div className="flex gap-2">
            {COLORES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`h-9 w-9 rounded-lg border-[3px] transition ${color === c ? 'scale-110 border-white' : 'border-transparent'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <Subtitulo>¿Quién lleva la cuenta?</Subtitulo>
          <div className="flex flex-wrap gap-1.5">
            {empleados.map((a) => {
              const lleva = equipo.includes(a.id)
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setEquipo((l) => (lleva ? l.filter((x) => x !== a.id) : [...l, a.id]))}
                  className={`rounded-lg border-2 px-3 py-1.5 text-sm font-black ${lleva ? 'border-white text-noche' : 'border-white/20 bg-black/30 text-white/60'}`}
                  style={lleva ? { background: a.color } : undefined}
                >
                  {lleva ? '✓ ' : ''}
                  {a.nombre}
                </button>
              )
            })}
          </div>
        </div>
        {error && <p className="font-bold text-alerta">{error}</p>}
        <Boton type="submit" disabled={!nombre.trim()}>
          Crear cliente
        </Boton>
      </form>
    </Pantalla>
  )
}
