import { useState, type FormEvent } from 'react'
import { supabase } from '@/datos/supabase'

const claseCampo = 'w-full rounded-xl bg-black/30 px-4 py-3 font-bold outline-none focus:ring-4 focus:ring-oro'
const claseBoton =
  'titulo-juego w-full rounded-xl border-b-4 border-yellow-700 bg-oro py-3 text-2xl text-noche transition hover:brightness-110 disabled:opacity-60'

// Entrar con correo y contraseña. Si la olvidaste: te llega un código de 6 cifras por correo
// y aquí mismo pones la contraseña nueva (sin enlaces, que en una app de escritorio no funcionan).
export default function Login() {
  const [modo, setModo] = useState<'entrar' | 'olvide' | 'codigo'>('entrar')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    setAviso(null)
    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave })
      if (error) setError(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message)
    } else if (modo === 'olvide') {
      const { error } = await supabase.auth.resetPasswordForEmail(correo)
      if (error)
        setError(
          error.message.includes('rate limit')
            ? 'Supabase solo deja enviar unos pocos correos por hora. Espera un rato o usa el último enlace que te llegó con "Ya tengo un enlace".'
            : error.message
        )
      else {
        setModo('codigo')
        setClave('')
        setAviso('Te llegará un correo. NO abras el enlace: haz clic derecho sobre él → "Copiar dirección del enlace" y pégalo aquí (o escribe el código si viene uno).')
      }
    } else {
      if (clave.length < 8) setError('La contraseña nueva debe tener al menos 8 caracteres.')
      else {
        // Vale el código de 6 cifras o el enlace del correo copiado (sin abrirlo): de él se saca su clave secreta
        const pegado = codigo.trim()
        const claveEnlace = pegado.startsWith('http') ? new URL(pegado).searchParams.get('token') : null
        const { error } = claveEnlace
          ? await supabase.auth.verifyOtp({ token_hash: claveEnlace, type: 'recovery' })
          : await supabase.auth.verifyOtp({ email: correo, token: pegado, type: 'recovery' })
        if (error) setError(error.message.includes('expired') || error.message.includes('invalid') ? 'El código o el enlace no vale o ya caducó. Pide otro y no abras el enlace, solo cópialo.' : error.message)
        else {
          const r = await supabase.auth.updateUser({ password: clave })
          if (r.error) setError(r.error.message)
        }
      }
    }
    setOcupado(false)
  }

  const cambiar = (nuevo: typeof modo) => {
    setModo(nuevo)
    setError(null)
    setAviso(null)
  }

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-b from-cielo to-sky-200">
      <form onSubmit={enviar} className="panel-juego w-96 space-y-4 p-8">
        <h1 className="titulo-juego text-center text-4xl text-oro">Drafsoy HQ</h1>
        <p className="text-center text-sm text-white/70">
          {modo === 'entrar' ? 'Entra para abrir tu oficina' : modo === 'olvide' ? 'Te enviaremos un código a tu correo' : 'Pega el enlace del correo y pon tu contraseña nueva'}
        </p>
        <input type="email" required placeholder="Tu correo" value={correo} onChange={(e) => setCorreo(e.target.value)} disabled={modo === 'codigo'} className={claseCampo} />
        {modo === 'codigo' && (
          <input
            required
            autoComplete="one-time-code"
            placeholder="Pega el enlace del correo o el código"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className={claseCampo}
          />
        )}
        {modo !== 'olvide' && (
          <input
            type="password"
            required
            placeholder={modo === 'codigo' ? 'Contraseña nueva (mínimo 8)' : 'Contraseña'}
            autoComplete={modo === 'codigo' ? 'new-password' : 'current-password'}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            className={claseCampo}
          />
        )}
        {aviso && <p className="rounded-lg bg-vida/20 px-3 py-2 text-sm font-bold text-vida">{aviso}</p>}
        {error && <p className="rounded-lg bg-alerta/20 px-3 py-2 text-sm font-bold text-alerta">{error}</p>}
        <button disabled={ocupado} className={claseBoton}>
          {ocupado ? 'Un momento…' : modo === 'entrar' ? '¡A jugar!' : modo === 'olvide' ? 'Enviar código' : 'Cambiar y entrar'}
        </button>
        <button
          type="button"
          onClick={() => cambiar(modo === 'entrar' ? 'olvide' : 'entrar')}
          className="w-full text-center text-sm font-bold text-sky-200 hover:underline"
        >
          {modo === 'entrar' ? '¿Olvidaste tu contraseña?' : 'Volver a entrar con mi contraseña'}
        </button>
        {modo === 'olvide' && (
          <button type="button" onClick={() => cambiar('codigo')} className="w-full text-center text-xs text-white/60 hover:underline">
            Ya tengo un enlace o un código en mi correo
          </button>
        )}
        {modo === 'codigo' && (
          <button type="button" onClick={() => cambiar('olvide')} className="w-full text-center text-xs text-white/60 hover:underline">
            No me llegó nada: enviar otro correo
          </button>
        )}
      </form>
    </div>
  )
}
