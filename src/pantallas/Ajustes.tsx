import { useEffect, useState } from 'react'
import { supabase } from '@/datos/supabase'
import { usarDatos } from '@/datos/DatosProvider'
import { MODELOS } from '@/datos/catalogo'
import BarraEscudo from '@/componentes/BarraEscudo'
import { Boton, Pantalla, Subtitulo, Tarjeta, Titulo, claseCampo } from '@/componentes/ui'

export default function Ajustes() {
  const { ajustes } = usarDatos()
  const [tope, setTope] = useState(50)
  const [modeloRecepcion, setModeloRecepcion] = useState('claude-haiku-5-5')
  const [modeloAgentes, setModeloAgentes] = useState('claude-sonnet-5-5')
  const [correo, setCorreo] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    if (!ajustes) return
    setTope(Number(ajustes.tope_mensual_usd))
    setModeloRecepcion(ajustes.modelo_recepcion)
    setModeloAgentes(ajustes.modelo_agentes)
  }, [ajustes])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCorreo(data.user?.email ?? ''))
  }, [])

  async function guardar() {
    const cambios = { tope_mensual_usd: tope, modelo_recepcion: modeloRecepcion, modelo_agentes: modeloAgentes }
    const { error } = ajustes
      ? await supabase.from('ajustes').update(cambios).eq('dueno', ajustes.dueno)
      : await supabase.from('ajustes').insert(cambios)
    setMensaje(error ? `Error: ${error.message}` : '¡Guardado!')
  }

  return (
    <Pantalla>
      <Titulo>Ajustes</Titulo>
      <div className="mt-6 grid max-w-3xl gap-4">
        <Tarjeta>
          <Subtitulo>Gasto de IA este mes</Subtitulo>
          <BarraEscudo ancho="w-full" />
        </Tarjeta>

        {/* Interruptor general: el equipo se pone a trabajar solo en cuanto tiene tareas */}
        <Tarjeta className="flex items-center justify-between gap-4">
          <div>
            <Subtitulo>Trabajo automático</Subtitulo>
            <p className="text-sm text-white/70">
              {ajustes?.trabajo_automatico ? 'El equipo empieza solo las tareas que le asignan.' : 'Pausado: nadie empieza tareas nuevas hasta que lo actives.'}
            </p>
          </div>
          <button
            onClick={() => ajustes && supabase.from('ajustes').update({ trabajo_automatico: !ajustes.trabajo_automatico }).eq('dueno', ajustes.dueno).then(({ error }) => error && alert(`No se pudo guardar: ${error.message}`))}
            className={`relative h-9 w-16 shrink-0 rounded-full border-2 border-white/30 transition ${ajustes?.trabajo_automatico ? 'bg-vida' : 'bg-black/40'}`}
            title="Activar o pausar el trabajo automático"
          >
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${ajustes?.trabajo_automatico ? 'left-8' : 'left-1'}`} />
          </button>
        </Tarjeta>

        <Tarjeta className="space-y-4">
          <label className="block">
            <Subtitulo>Tope de gasto mensual total (USD)</Subtitulo>
            <input type="number" min={0} step={1} value={tope} onChange={(e) => setTope(Number(e.target.value))} className={`${claseCampo} w-40`} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <Subtitulo>Modelo de la recepción</Subtitulo>
              <select value={modeloRecepcion} onChange={(e) => setModeloRecepcion(e.target.value)} className={claseCampo}>
                {MODELOS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.texto}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <Subtitulo>Modelo por defecto de agentes nuevos</Subtitulo>
              <select value={modeloAgentes} onChange={(e) => setModeloAgentes(e.target.value)} className={claseCampo}>
                {MODELOS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.texto}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Boton onClick={guardar}>Guardar</Boton>
            {mensaje && <span className={`font-bold ${mensaje.startsWith('Error') ? 'text-alerta' : 'text-vida'}`}>{mensaje}</span>}
          </div>
        </Tarjeta>

        <TarjetaGoogle />

        <Tarjeta className="flex items-center justify-between">
          <div>
            <Subtitulo>Cuenta</Subtitulo>
            <p className="font-bold">{correo}</p>
          </div>
          <Boton variante="gris" onClick={() => supabase.auth.signOut()}>
            Cerrar sesión
          </Boton>
        </Tarjeta>
      </div>
    </Pantalla>
  )
}

// Conexión con Google Drive y Calendar. Los permisos se guardan cifrados en el cerebro; aquí solo se ve el correo.
function TarjetaGoogle() {
  const [estado, setEstado] = useState<{ configurado: boolean; conectado: boolean; correo: string | null; faltaGmail: boolean } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.drafsoy.google.estado().then(setEstado)
  }, [])

  async function conectar() {
    setOcupado(true)
    setError(null)
    const r = await window.drafsoy.google.conectar()
    if (!r.ok) setError(r.error ?? 'No se pudo conectar.')
    setEstado(await window.drafsoy.google.estado())
    setOcupado(false)
  }

  async function desconectar() {
    setOcupado(true)
    await window.drafsoy.google.desconectar()
    setEstado(await window.drafsoy.google.estado())
    setOcupado(false)
  }

  return (
    <Tarjeta className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Subtitulo>Google (Drive, Calendar y Gmail)</Subtitulo>
          <p className="text-sm text-white/70">
            {!estado
              ? 'Comprobando…'
              : !estado.configurado
                ? 'Falta GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el archivo .env.'
                : estado.conectado
                  ? `Conectado como ${estado.correo}. Documentos, reuniones y correos solo salen cuando apruebas en la bandeja.`
                  : 'Sin conectar. Al conectar podrás aprobar que los agentes dejen documentos en tu Drive, agenden reuniones y envíen correos.'}
          </p>
          {estado?.faltaGmail && !ocupado && (
            <p className="text-sm font-bold text-oro">Falta el permiso nuevo de Gmail: pulsa "Dar permiso de Gmail" y marca todas las casillas.</p>
          )}
          {ocupado && <p className="text-sm text-oro">Se abrió tu navegador: elige tu cuenta y acepta los permisos.</p>}
        </div>
        {estado?.conectado && estado.faltaGmail ? (
          <Boton disabled={ocupado} onClick={conectar}>
            Dar permiso de Gmail
          </Boton>
        ) : estado?.conectado ? (
          <Boton variante="gris" disabled={ocupado} onClick={desconectar}>
            Desconectar
          </Boton>
        ) : (
          <Boton disabled={ocupado || !estado?.configurado} onClick={conectar}>
            Conectar Google
          </Boton>
        )}
      </div>
      {error && <p className="text-sm font-bold text-alerta">{error}</p>}
    </Tarjeta>
  )
}
