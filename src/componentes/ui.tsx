import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Piezas visuales reutilizables con estilo de videojuego.

type Variante = 'oro' | 'azul' | 'rojo' | 'verde' | 'gris'

const VARIANTES: Record<Variante, string> = {
  oro: 'bg-gradient-to-b from-yellow-300 to-oro text-noche border-yellow-700',
  azul: 'bg-gradient-to-b from-sky-400 to-escudo text-white border-blue-800',
  rojo: 'bg-gradient-to-b from-rose-400 to-alerta text-white border-red-800',
  verde: 'bg-gradient-to-b from-lime-300 to-vida text-noche border-green-800',
  gris: 'bg-white/15 text-white border-black/40'
}

export function Boton({
  variante = 'oro',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...props}
      className={`titulo-juego rounded-xl border-b-4 px-4 py-2 text-lg tracking-wide uppercase transition hover:scale-[1.03] hover:brightness-110 active:translate-y-0.5 active:border-b-2 disabled:pointer-events-none disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
    />
  )
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border-2 border-white/15 bg-black/25 p-4 ${className}`}>{children}</div>
}

export function Etiqueta({ texto, color }: { texto: string; color: string }) {
  return (
    <span className="rounded-full border border-black/30 px-2 py-0.5 text-[11px] font-black whitespace-nowrap text-noche" style={{ background: color }}>
      {texto}
    </span>
  )
}

export function Titulo({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <h2 className="titulo-juego text-3xl leading-tight uppercase" style={{ color: color ?? 'white' }}>
      {children}
    </h2>
  )
}

export function Subtitulo({ children }: { children: ReactNode }) {
  return (
    <p className="inclinado mb-2 inline-block rounded bg-black/30 px-2 py-0.5 text-[11px] font-black tracking-widest text-oro uppercase">
      <span>{children}</span>
    </p>
  )
}

export const claseCampo =
  'w-full rounded-xl border-2 border-white/10 bg-black/30 px-3 py-2 font-bold text-white outline-none focus:border-oro placeholder:text-white/40'

export function Pantalla({ children }: { children: ReactNode }) {
  return <div className="h-full overflow-y-auto p-6">{children}</div>
}

export function Vacio({ texto }: { texto: string }) {
  return <p className="rounded-xl border-2 border-dashed border-white/20 p-4 text-center text-sm text-white/50">{texto}</p>
}
