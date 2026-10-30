import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { Check, Copy, Paperclip, X } from 'lucide-react'
import { supabase } from '@/datos/supabase'
import { usarDatos } from '@/datos/DatosProvider'
import { usarRuta } from '@/navegacion'
import { Avatar, Boton, Titulo, claseCampo } from '@/componentes/ui'

// Chat con la recepcionista o, si llega agenteId, chat directo con ese empleado
// embebido: dentro de la ficha del empleado (la ficha ya muestra su foto y su nombre arriba)
export default function ChatRecepcion({ agenteId, embebido = false }: { agenteId?: string; embebido?: boolean }) {
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
  const [imagen, setImagen] = useState<string | null>(null)
  const [enGrande, setEnGrande] = useState<string | null>(null)
  const final = useRef<HTMLDivElement>(null)
  const archivo = useRef<HTMLInputElement>(null)

  const adjuntar = async (f: File | null | undefined) => {
    if (!f || !f.type.startsWith('image/')) return
    try {
      setImagen(await reducirImagen(f))
    } catch {
      setError('No pude leer esa imagen.')
    }
  }

  // Pegar una captura con Ctrl+V directamente en el chat
  const alPegar = (e: ClipboardEvent) => {
    const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'))
    if (item) {
      e.preventDefault()
      adjuntar(item.getAsFile())
    }
  }

  useEffect(() => {
    final.current?.scrollIntoView({ behavior: 'smooth' })
  }, [delCanal.length, pensando])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const contenido = texto.trim() || (imagen ? 'Te mando esta imagen.' : '')
    if (!contenido || pensando) return
    const adjunta = imagen
    setTexto('')
    setImagen(null)
    setError(null)
    setPensando(true)
    // El cerebro guarda tu mensaje, piensa la respuesta con la IA y crea las tareas
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token ?? ''
    const resultado = empleado
      ? await window.drafsoy.agentes.charlar(empleado.id, contenido, token, adjunta)
      : await window.drafsoy.recepcion.enviar(contenido, token, adjunta)
    if (!resultado.ok) setError(resultado.error ?? 'No pude enviar el mensaje.')
    setPensando(false)
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* Imagen en grande (clic para cerrar) */}
      {enGrande && (
        <button type="button" onClick={() => setEnGrande(null)} className="absolute inset-0 z-20 flex cursor-zoom-out items-center justify-center bg-black/80 p-6">
          <img src={enGrande} alt="Imagen en grande" className="max-h-full max-w-full rounded-xl object-contain" />
        </button>
      )}
      {!embebido && (
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
      )}

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
              className={`group max-w-[80%] rounded-2xl px-4 py-2 whitespace-pre-wrap select-text ${
                m.rol === 'usuario'
                  ? 'rounded-br-sm bg-tinta text-white'
                  : m.rol === 'sistema'
                    ? 'bg-suave text-sm text-tinta-suave italic'
                    : 'rounded-bl-sm bg-suave'
              }`}
            >
              {m.imagen && (
                <button type="button" onClick={() => setEnGrande(m.imagen)} title="Ver en grande" className="block">
                  <img src={m.imagen} alt="Imagen adjunta" className="mb-1.5 max-h-64 cursor-zoom-in rounded-xl border border-white/20 object-contain" />
                </button>
              )}
              <TextoConFormato texto={m.contenido} />
              {m.tarea_id && <span className="mt-1 block text-[11px] font-bold text-lima-osc">🪂 Tarea creada</span>}
              <BotonCopiar texto={m.contenido} />
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
      <form onSubmit={enviar} className="border-t-2 border-linea bg-suave px-6 py-4">
        {imagen && (
          <div className="relative mb-2 inline-block">
            <img src={imagen} alt="Imagen para enviar" className="max-h-28 rounded-xl border border-linea object-contain" />
            <button
              type="button"
              onClick={() => setImagen(null)}
              title="Quitar imagen"
              className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-tinta text-white shadow"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex gap-2">
        <button
          type="button"
          onClick={() => archivo.current?.click()}
          disabled={pensando}
          title="Adjuntar imagen (también puedes pegar una captura con Ctrl+V)"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-tinta-suave transition hover:text-tinta disabled:opacity-50"
        >
          <Paperclip size={18} />
        </button>
        <input ref={archivo} type="file" accept="image/*" className="hidden" onChange={(e) => (adjuntar(e.target.files?.[0]), (e.target.value = ''))} />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onPaste={alPegar}
          placeholder={empleado ? `Escríbele a ${nombre}… (puedes pegar capturas con Ctrl+V)` : `Escribe un encargo para ${nombre}… (puedes pegar capturas con Ctrl+V)`}
          disabled={pensando}
          className={claseCampo}
        />
        <Boton type="submit" disabled={pensando || (!texto.trim() && !imagen)}>
          Enviar
        </Boton>
        </div>
      </form>
    </div>
  )
}

// Formato sencillo de los mensajes: **negrita** y listas con "- "
// Copia el mensaje sin los ** del formato. Aparece al pasar el ratón por encima del mensaje.
function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    await navigator.clipboard.writeText(texto.replace(/\*\*/g, ''))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }
  return (
    <button
      type="button"
      onClick={copiar}
      className={`mt-1 flex items-center gap-1 text-[11px] font-bold opacity-0 transition group-hover:opacity-70 hover:opacity-100 focus:opacity-100 ${copiado ? 'opacity-100' : ''}`}
    >
      {copiado ? <Check size={12} /> : <Copy size={12} />}
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  )
}

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

// Reduce la imagen (lado máx. 1568 px, JPEG) para que pese poco y la IA la lea bien
const LADO_MAX = 1568
function reducirImagen(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height))
      const lienzo = document.createElement('canvas')
      lienzo.width = Math.round(img.width * escala)
      lienzo.height = Math.round(img.height * escala)
      const c = lienzo.getContext('2d')!
      c.fillStyle = '#ffffff'
      c.fillRect(0, 0, lienzo.width, lienzo.height)
      c.drawImage(img, 0, 0, lienzo.width, lienzo.height)
      URL.revokeObjectURL(url)
      resolve(lienzo.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('imagen no válida'))
    }
    img.src = url
  })
}
