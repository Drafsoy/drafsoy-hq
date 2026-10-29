import { useState, type FormEvent } from 'react'
import { usarDatos } from '@/datos/DatosProvider'
import { ACCIONES_EXTERNAS, HERRAMIENTAS, MODELOS } from '@/datos/catalogo'
import type { Agente, TareaRecurrente } from '@/datos/tipos'
import { Boton, Subtitulo, claseCampo } from './ui'
import SelectorFoto from './SelectorFoto'

// La "plantilla" de agente. Sirve para editar uno existente y (en el Paso 8) para crear uno nuevo.
export type DatosAgente = Pick<
  Agente,
  | 'nombre'
  | 'rol'
  | 'color'
  | 'instrucciones'
  | 'herramientas'
  | 'modelo'
  | 'acciones_con_aprobacion'
  | 'tareas_recurrentes'
  | 'tope_gasto_usd'
  | 'skin_avatar'
  | 'skin_modelo'
>

interface Props {
  inicial: DatosAgente
  textoBoton: string
  cuentasIniciales: string[]
  alGuardar: (datos: DatosAgente, cuentas: string[]) => Promise<string | null>
}

export default function FormularioAgente({ inicial, textoBoton, cuentasIniciales, alGuardar }: Props) {
  const { clientes } = usarDatos()
  const [cuentas, setCuentas] = useState<string[]>(cuentasIniciales)
  const [datos, setDatos] = useState<DatosAgente>(inicial)
  const [recurrentes, setRecurrentes] = useState<TareaRecurrente[]>(inicial.tareas_recurrentes ?? [])
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cambiar = <K extends keyof DatosAgente>(campo: K, valor: DatosAgente[K]) => setDatos((d) => ({ ...d, [campo]: valor }))

  const alternarHerramienta = (id: string) =>
    cambiar('herramientas', datos.herramientas.includes(id) ? datos.herramientas.filter((h) => h !== id) : [...datos.herramientas, id])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    const tareas_recurrentes = recurrentes.map((t) => ({ ...t, texto: t.texto.trim() })).filter((t) => t.texto)
    const error = await alGuardar({
      ...datos,
      tareas_recurrentes,
      // Todas las acciones externas pasan por aprobación, sin excepción.
      acciones_con_aprobacion: ACCIONES_EXTERNAS.map((a) => a.id)
    }, cuentas)
    setMensaje(error ? `Error: ${error}` : '¡Guardado!')
    setGuardando(false)
  }

  return (
    <form onSubmit={enviar} className="grid grid-cols-2 gap-6">
      <div className="space-y-4">
        <Campo texto="Nombre">
          <input required value={datos.nombre} onChange={(e) => cambiar('nombre', e.target.value)} className={claseCampo} />
        </Campo>
        <Campo texto="Rol">
          <input required value={datos.rol} onChange={(e) => cambiar('rol', e.target.value)} placeholder="Trafficker, Copywriter, Analista…" className={claseCampo} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">

          <Campo texto="Color del personaje">
            <input type="color" value={datos.color} onChange={(e) => cambiar('color', e.target.value)} className="h-10 w-full cursor-pointer rounded-xl bg-suave" />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo texto="Modelo de IA">
            <select value={datos.modelo} onChange={(e) => cambiar('modelo', e.target.value)} className={claseCampo}>
              {MODELOS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.texto}
                </option>
              ))}
            </select>
          </Campo>
          <Campo texto="Tope de gasto mensual (USD)">
            <input
              type="number"
              min={0}
              step={0.5}
              value={datos.tope_gasto_usd}
              onChange={(e) => cambiar('tope_gasto_usd', Number(e.target.value))}
              className={claseCampo}
            />
          </Campo>
        </div>
        <Campo texto="Instrucciones (cómo trabaja este agente)">
          <textarea rows={6} value={datos.instrucciones} onChange={(e) => cambiar('instrucciones', e.target.value)} className={claseCampo} />
        </Campo>
        <div>
          <span className="mb-1 block text-xs font-bold tracking-wider text-tinta-suave uppercase">Tareas que repite cada semana</span>
          <Recurrentes lista={recurrentes} cambiar={setRecurrentes} />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Subtitulo>Cuentas que lleva</Subtitulo>
          <div className="flex flex-wrap gap-1.5">
            {clientes.map((c) => {
              const lleva = cuentas.includes(c.id)
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setCuentas((l) => (lleva ? l.filter((x) => x !== c.id) : [...l, c.id]))}
                  className={`rounded-lg border-2 px-3 py-1.5 text-sm font-bold transition ${lleva ? 'border-violeta bg-violeta-suave text-tinta' : 'border-linea bg-suave text-tinta-suave'}`}
                  style={lleva ? { background: c.color } : undefined}
                >
                  {lleva ? '✓ ' : ''}
                  {c.nombre}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <Subtitulo>Herramientas</Subtitulo>
          <div className="space-y-1">
            {HERRAMIENTAS.map((h) => (
              <label key={h.id} className="flex cursor-pointer items-center gap-2 rounded-lg bg-suave px-3 py-2 text-sm font-bold">
                <input type="checkbox" checked={datos.herramientas.includes(h.id)} onChange={() => alternarHerramienta(h.id)} className="h-4 w-4 accent-oro" />
                {h.texto}
              </label>
            ))}
          </div>
        </div>
        <div>
          <Subtitulo>Acciones que necesitan tu aprobación</Subtitulo>
          <div className="space-y-1">
            {ACCIONES_EXTERNAS.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg bg-suave px-3 py-2 text-sm font-bold text-tinta/80">
                🔒 {a.texto}
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-tinta-suave/70">Siempre activas: ningún agente puede hacer esto sin que lo apruebes.</p>
        </div>
        <div>
          <Subtitulo>Foto del empleado</Subtitulo>
          <SelectorFoto valor={datos.skin_avatar} alCambiar={(foto) => cambiar('skin_avatar', foto)} />
        </div>
        <Campo texto="Skin 3D (nombre de la skin, si no es la de su nombre)">
          <input value={datos.skin_modelo ?? ''} onChange={(e) => cambiar('skin_modelo', e.target.value || null)} placeholder="Por ejemplo: midas" className={claseCampo} />
        </Campo>
        <div className="flex items-center gap-3 pt-2">
          <Boton type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : textoBoton}
          </Boton>
          {mensaje && <span className={`font-bold ${mensaje.startsWith('Error') ? 'text-alerta' : 'text-emerald-600'}`}>{mensaje}</span>}
        </div>
      </div>
    </form>
  )
}

function Campo({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold tracking-wider text-tinta-suave uppercase">{texto}</span>
      {children}
    </label>
  )
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// Cada fila: qué día, a qué hora, para qué cliente y qué tiene que hacer. La app se la apunta sola mientras esté abierta.
function Recurrentes({ lista, cambiar }: { lista: TareaRecurrente[]; cambiar: (l: TareaRecurrente[]) => void }) {
  const { clientes } = usarDatos()
  // Al cambiar una fila se borra "ultima", por si Rafa la mueve a otra hora del mismo día
  const editar = (i: number, cambio: Partial<TareaRecurrente>) => cambiar(lista.map((t, j) => (j === i ? { ...t, ...cambio, ultima: undefined } : t)))
  return (
    <div className="space-y-2">
      {lista.map((t, i) => (
        <div key={i} className="space-y-2 rounded-xl bg-suave p-2">
          <div className="flex gap-2">
            <select value={t.dia ?? ''} onChange={(e) => editar(i, { dia: e.target.value === '' ? undefined : Number(e.target.value) })} className={claseCampo}>
              <option value="">Sin día (no se repite)</option>
              {DIAS.map((d, n) => (
                <option key={d} value={n}>
                  Cada {d}
                </option>
              ))}
            </select>
            <input type="time" value={t.hora ?? ''} onChange={(e) => editar(i, { hora: e.target.value })} className={`${claseCampo} w-32`} />
            <button type="button" onClick={() => cambiar(lista.filter((_, j) => j !== i))} className="px-2 text-sm font-bold text-tinta-suave" title="Quitar">
              ✕
            </button>
          </div>
          <select value={t.cliente_id ?? ''} onChange={(e) => editar(i, { cliente_id: e.target.value || null })} className={claseCampo}>
            <option value="">Sin cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <textarea rows={3} value={t.texto} onChange={(e) => editar(i, { texto: e.target.value })} placeholder="Qué tiene que hacer" className={claseCampo} />
        </div>
      ))}
      <Boton type="button" variante="gris" onClick={() => cambiar([...lista, { texto: '', dia: 1, hora: '09:00' }])}>
        + Añadir tarea semanal
      </Boton>
    </div>
  )
}
