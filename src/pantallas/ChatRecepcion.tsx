import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '@/datos/supabase'
import { usarDatos } from '@/datos/DatosProvider'
import { Boton, Titulo, claseCampo } from '@/componentes/ui'

export default function ChatRecepcion() {
  const { mensajes, agentes } = usarDatos()
  const recepcionista = agentes.find((a) => a.es_recepcionista)
  const nombre = recepcionista?.nombre ?? 'Recepción'
  const delCanal = mensajes.filter((m) => m.canal === 'recepcion').sort((a, b) => a.creado_en.localeCompare(b.creado_en))
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
    const resultado = await window.drafsoy.recepcion.enviar(contenido, data.session?.access_token ?? '')
    if (!resultado.ok) setError(resultado.error ?? 'No pude enviar el mensaje.')
    setPensando(false)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b-2 border-white/15 bg-black/20 py-4 pr-16 pl-6">
        <span className="h-12 w-10 rounded-md border-4 border-black/40" style={{ background: recepcionista?.color ?? '#ffc93c' }} />
        <div>
          <Titulo color="#ffc93c">{nombre}</Titulo>
          <p className="text-sm text-white/60">Dime qué necesitas y se lo paso a quien lleva esa cuenta.</p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
        {delCanal.length === 0 && (
          <div className="space-y-2 text-center text-white/50">
            <p>Escribe tu primer encargo, por ejemplo:</p>
            <p className="italic">“Para WSE necesito 3 copies para el viernes, urgente”</p>
            <p className="italic">“¿Qué tenemos para hoy?”</p>
          </div>
        )}
        {delCanal.map((m) => (
          <div key={m.id} className={`flex ${m.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 whitespace-pre-wrap ${
                m.rol === 'usuario'
                  ? 'rounded-br-sm bg-escudo text-white'
                  : m.rol === 'sistema'
                    ? 'bg-black/30 text-sm text-white/60 italic'
                    : 'rounded-bl-sm bg-white/15'
              }`}
            >
              <TextoConFormato texto={m.contenido} />
              {m.tarea_id && <span className="mt-1 block text-[11px] font-black text-oro">🪂 Tarea creada</span>}
            </div>
          </div>
        ))}
        {pensando && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-white/15 px-4 py-2 text-white/70">
              <span className="animate-pulse">{nombre} está escribiendo…</span>
            </div>
          </div>
        )}
        <div ref={final} />
      </div>

      {error && <p className="mx-6 mb-2 rounded-lg bg-alerta/20 px-3 py-2 text-sm font-bold text-alerta">{error}</p>}
      <form onSubmit={enviar} className="flex gap-2 border-t-2 border-white/15 bg-black/20 px-6 py-4">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={`Escribe un encargo para ${nombre}…`}
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
