import { useState } from 'react'
import { supabase } from '@/datos/supabase'
import { clientesDeAgente, usarDatos } from '@/datos/DatosProvider'
import { ACCIONES_EXTERNAS } from '@/datos/catalogo'
import { ESTADOS_APROBACION, type Aprobacion } from '@/datos/tipos'
import { Boton, Etiqueta, Pantalla, Subtitulo, Tarjeta, Titulo, Vacio, claseCampo } from '@/componentes/ui'

export default function Bandeja() {
  const datos = usarDatos()
  const { aprobaciones, agentes, clientes } = datos
  const supervisor = agentes.find((a) => a.es_supervisor)
  const ordenadas = [...aprobaciones].sort((a, b) => b.creado_en.localeCompare(a.creado_en))
  const pendientes = ordenadas.filter((a) => a.estado === 'pendiente')
  const enRevision = ordenadas.filter((a) => a.estado === 'en_revision')
  const historial = ordenadas.filter((a) => a.estado !== 'pendiente' && a.estado !== 'en_revision').slice(0, 30)
  const nombreAgente = (id: string | null) => agentes.find((x) => x.id === id)?.nombre
  const nombreCliente = (id: string | null) => clientes.find((c) => c.id === id)?.nombre

  // Para probar la bandeja sin esperar a que un empleado proponga algo
  async function crearPrueba() {
    const agente = agentes.find((a) => !a.es_recepcionista && !a.es_supervisor)
    await supabase.from('aprobaciones').insert({
      agente_id: agente?.id ?? null,
      cliente_id: agente ? (clientesDeAgente(datos, agente.id)[0]?.id ?? null) : null,
      tipo_accion: 'publicar',
      titulo: 'Publicar anuncio de prueba en Instagram',
      detalle: { texto: '¡Aprende inglés en 3 meses! 🎉', red: 'Instagram', presupuesto_diario: '15 USD' }
    })
  }

  return (
    <Pantalla>
      <div className="mb-6 pr-12">
        <Titulo color="#3fb6ff">Bandeja de aprobaciones</Titulo>
        <p className="text-tinta/80">
          {supervisor ? `Todo pasa primero por ${supervisor.nombre} y luego por ti.` : 'Aquí llega todo lo que tu equipo quiere hacer fuera.'} Nada sale al mundo exterior sin tu visto bueno.
        </p>
        <Boton variante="gris" className="mt-3 text-sm" onClick={crearPrueba}>
          + Aprobación de prueba
        </Boton>
      </div>

      <Subtitulo>Esperando tu decisión ({pendientes.length})</Subtitulo>
      <div className="mb-8 space-y-3">
        {pendientes.length === 0 && <Vacio texto="Todo al día. No hay nada por aprobar. 🎉" />}
        {pendientes.map((a) => (
          <TarjetaAprobacion
            key={a.id}
            aprobacion={a}
            agente={nombreAgente(a.agente_id)}
            cliente={nombreCliente(a.cliente_id)}
            contenido={a.tipo_accion === 'subir_archivo' ? (datos.tareas.find((t) => t.id === a.tarea_id)?.resultado ?? null) : null}
          />
        ))}
      </div>

      {enRevision.length > 0 && (
        <>
          <Subtitulo>
            {supervisor ? `Revisando ${supervisor.nombre}` : 'Preparándose'} ({enRevision.length})
          </Subtitulo>
          <div className="mb-8 space-y-2">
            {enRevision.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl bg-violeta-suave px-4 py-2 text-sm">
                <span className="animate-pulse">🔎</span>
                <span className="flex-1 font-bold">{a.titulo}</span>
                <span className="text-xs text-tinta-suave">
                  {nombreAgente(a.agente_id)} · {nombreCliente(a.cliente_id)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <Subtitulo>Historial</Subtitulo>
      <div className="space-y-2">
        {historial.length === 0 && <Vacio texto="Aún no has decidido nada." />}
        {historial.map((a) => (
          <div key={a.id} className="rounded-xl bg-suave px-4 py-2 text-sm">
            <div className="flex items-center gap-3">
              <Etiqueta {...ESTADOS_APROBACION[a.estado]} />
              <span className="flex-1 font-bold">{a.titulo}</span>
              <span className="text-xs text-tinta-suave/70">{new Date(a.resuelto_en ?? a.creado_en).toLocaleString('es')}</span>
            </div>
            {a.comentario && <p className="mt-1 text-tinta-suave italic">“{a.comentario}”</p>}
            {(a.estado === 'ejecutada' || a.estado === 'fallida') && a.resultado && (
              <p className={`mt-1 text-xs ${a.estado === 'fallida' ? 'text-alerta' : 'text-emerald-600'}`}>
                ⚙️ {String(a.resultado.mensaje ?? '')}
                {typeof a.resultado.enlace === 'string' && (
                  <a href={a.resultado.enlace} target="_blank" rel="noreferrer" className="ml-2 font-bold text-cielo underline">
                    Abrir en Google ↗
                  </a>
                )}
                {typeof a.resultado.meet === 'string' && (
                  <a href={a.resultado.meet} target="_blank" rel="noreferrer" className="ml-2 font-bold text-cielo underline">
                    Enlace de Meet ↗
                  </a>
                )}
              </p>
            )}
          </div>
        ))}
      </div>
    </Pantalla>
  )
}

function TarjetaAprobacion({ aprobacion, agente, cliente, contenido }: { aprobacion: Aprobacion; agente?: string; cliente?: string; contenido: string | null }) {
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const accion = ACCIONES_EXTERNAS.find((x) => x.id === aprobacion.tipo_accion)?.texto ?? aprobacion.tipo_accion

  async function decidir(decision: 'aprobada' | 'rechazada') {
    setEnviando(true)
    setError(null)
    const { data } = await supabase.auth.getSession()
    // El cerebro registra tu decisión y, si apruebas, el ejecutor la lleva a cabo
    const r = await window.drafsoy.aprobaciones.decidir(aprobacion.id, decision, comentario, data.session?.access_token ?? '')
    if (!r.ok) setError(r.error ?? 'No se pudo registrar la decisión.')
    setEnviando(false)
  }

  return (
    <Tarjeta className="border-amber-300">
      <div className="mb-2">
        <p className="text-xl">{aprobacion.titulo}</p>
        <p className="text-sm text-tinta/80">
          {agente ?? 'Agente'} {cliente ? `· ${cliente}` : ''} · quiere: <b className="text-violeta">{accion}</b>
        </p>
        <p className="text-xs text-tinta-suave/70">{new Date(aprobacion.creado_en).toLocaleString('es')}</p>
      </div>
      {aprobacion.nota_supervisor && (
        <p className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <b className="text-emerald-600">✅ Revisado:</b> {aprobacion.nota_supervisor}
        </p>
      )}
      <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-suave p-3 text-sm">
        {Object.entries(aprobacion.detalle).map(([clave, valor]) => (
          <div key={clave} className="contents">
            <dt className="font-bold text-tinta-suave">{clave.replaceAll('_', ' ')}</dt>
            <dd className="whitespace-pre-wrap">{typeof valor === 'string' ? valor : JSON.stringify(valor)}</dd>
          </div>
        ))}
      </dl>
      {contenido && (
        <details className="mb-3 rounded-xl bg-suave p-3 text-sm">
          <summary className="cursor-pointer font-bold text-tinta/80">Ver lo que se subirá al Drive</summary>
          <p className="mt-2 max-h-64 overflow-y-auto text-xs whitespace-pre-wrap text-tinta/80 select-text">{contenido}</p>
        </details>
      )}
      <input
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder="Comentario (si rechazas, el empleado lo rehace con esto)"
        className={`${claseCampo} mb-2`}
      />
      {error && <p className="mb-2 text-sm font-bold text-alerta">{error}</p>}
      <div className="flex gap-2">
        <Boton variante="verde" className="flex-1" disabled={enviando} onClick={() => decidir('aprobada')}>
          ✔ Aprobar
        </Boton>
        <Boton variante="rojo" className="flex-1" disabled={enviando} onClick={() => decidir('rechazada')}>
          ✖ Rechazar
        </Boton>
      </div>
    </Tarjeta>
  )
}
