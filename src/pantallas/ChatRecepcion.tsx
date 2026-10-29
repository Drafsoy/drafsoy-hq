import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '@/datos/supabase'
import { usarDatos } from '@/datos/DatosProvider'
import { usarRuta } from '@/navegacion'
import { Avatar, Boton, Titulo, claseCampo } from '@/componentes/ui'

// Chat con la recepcionista o, si llega agenteId, chat directo con ese empleado
export default function ChatRecepcion({ agenteId }: { agenteId?: string }) {
  const { mensajes, agentes } = usarDatos()
  const { ir } = usarRuta()
  const empleado = agenteId ? agentes.find((a) => a.id === agenteId) : undefined
  const recepcionista = empleado ?? agentes.find((a) => a.es_recepcionista)
  const nombre = recepcionista?.nombre ?? 'Recepción'
  const canal = empleado ? empleado.id : 'recepcion'
  const delCanal = mensajes.filter((m) => m.canal === canal).sort((a, b) => a.creado_en.localeCompare(b.creado_en))
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const final = useRef<HTMLDivElement>(null)

  useEffect(() => {
    final.current?.scrollIntoView({ behavior: 'smooth' })
  }, [delCanal.length, pensando])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const contenido = texto.trim()
    if (!contenido || pensando) return
    setTexto('')
    setError(null)
    setPensando(true)
    // El cerebro guarda tu mensaje, piensa la respuesta con la IA y crea las tareas
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token ?? ''
    const resultado = empleado
      ? await window.drafsoy.agentes.charlar(empleado.id, contenido, token)
      : await window.drafsoy.recepcion.enviar(contenido, token)
    if (!resultado.ok) setError(resultado.error ?? 'No pude enviar el mensaje.')
    setPensando(false)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b-2 border-linea bg-suave py-4 pr-16 pl-6">
        <Avatar nombre={nombre} color={recepcionista?.color ?? '#ffc93c'} foto={recepcionista?.skin_avatar ?? null} tam={48} />
        <div>
          <Titulo color="#ffc93c">{nombre}</Titulo>
          <p className="text-sm text-tinta-suave">
            {empleado ? `Habla con ${nombre} sobre sus cuentas y sus tareas.` : 'Dime qué necesitas y se lo paso a quien lleva esa cuenta.'}
          </p>
        </div>
        {empleado && (
          <button onClick={() => ir({ pantalla: 'agente', id: empleado.id })} className="ml-auto text-sm font-bold text-violeta hover:underline">
            Ver ficha
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
        {delCanal.length === 0 && (
          <div className="space-y-2 text-center text-tinta-suave">
            {empleado ? (
              <>
                <p>Pregúntale lo que quieras, por ejemplo:</p>
                <p className="italic">“¿En qué estás trabajando?”</p>
                <p className="italic">“¿Por qué me necesitas?”</p>
              </>
            ) : (
              <>
                <p>Escribe tu primer encargo, por ejemplo:</p>
                <p className="italic">“Para WSE necesito 3 copies para el viernes, urgente”</p>
                <p className="italic">“¿Qué tenemos para hoy?”</p>
              </>
            )}
          </div>
        )}
        {delCanal.map((m) => (
          <div key={m.id} className={`flex ${m.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 whitespace-pre-wrap ${
                m.rol === 'usuario'
                  ? 'rounded-br-sm bg-tinta text-white'
                  : m.rol === 'sistema'
                    ? 'bg-suave text-sm text-tinta-suave italic'
                    : 'rounded-bl-sm bg-suave'
              }`}
            >
              <TextoConFormato texto={m.contenido} />
              {m.tarea_id && <span className="mt-1 block text-[11px] font-bold text-lima-osc">🪂 Tarea creada</span>}
            </div>
          </div>
        ))}
        {pensando && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-suave px-4 py-2 text-tinta/80">
              <span className="animate-pulse">{nombre} está escribiendo…</span>
            </div>
          </div>
        )}
        <div ref={final} />
      </div>

      {error && <p className="mx-6 mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-alerta">{error}</p>}
      <form onSubmit={enviar} className="flex gap-2 border-t-2 border-linea bg-suave px-6 py-4">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={empleado ? `Escríbele a ${nombre}…` : `Escribe un encargo para ${nombre}…`}
          disabled={pensando}
          className={claseCampo}
        />
        <Boton type="submit" disabled={pensando || !texto.trim()}>
          Enviar
        </Boton>
      </form>
    </div>
  )
}

// Formato sencillo de los mensajes: **negrita** y listas con "- "
function TextoConFormato({ texto }: { texto: string }) {
  return (
    <>
      {texto.split('\n').map((linea, i) => {
        const vineta = /^\s*[-•]\s+/.test(linea)
        const partes = linea.replace(/^\s*[-•]\s+/, '').split(/(\*\*[^*]+\*\*)/g)
        return (
          <span key={i} className={`block ${vineta ? 'pl-3' : ''} ${linea.trim() === '' ? 'h-2' : ''}`}>
            {vineta && '• '}
            {partes.map((p, j) => (p.startsWith('**') && p.endsWith('**') ? <b key={j}>{p.slice(2, -2)}</b> : p))}
          </span>
        )
      })}
    </>
  )
}
