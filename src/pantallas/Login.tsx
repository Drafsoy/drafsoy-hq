import { useState, type FormEvent } from 'react'
import { supabase } from '@/datos/supabase'

export default function Login() {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setEntrando(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave })
    if (error) setError(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message)
    setEntrando(false)
  }

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-b from-cielo to-sky-200">
      <form onSubmit={entrar} className="panel-juego w-96 space-y-4 p-8">
        <h1 className="titulo-juego text-center text-4xl text-oro">Drafsoy HQ</h1>
        <p className="text-center text-sm text-white/70">Entra para abrir tu oficina</p>
        <input
          type="email"
          required
          placeholder="Tu correo"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className="w-full rounded-xl bg-black/30 px-4 py-3 font-bold outline-none focus:ring-4 focus:ring-oro"
        />
        <input
          type="password"
          required
          placeholder="Contraseña"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className="w-full rounded-xl bg-black/30 px-4 py-3 font-bold outline-none focus:ring-4 focus:ring-oro"
        />
        {error && <p className="rounded-lg bg-alerta/20 px-3 py-2 text-sm font-bold text-alerta">{error}</p>}
        <button
          disabled={entrando}
          className="titulo-juego w-full rounded-xl border-b-4 border-yellow-700 bg-oro py-3 text-2xl text-noche transition hover:brightness-110 disabled:opacity-60"
        >
          {entrando ? 'Entrando…' : '¡A jugar!'}
        </button>
      </form>
    </div>
  )
}
