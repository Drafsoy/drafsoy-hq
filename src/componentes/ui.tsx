import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Piezas visuales reutilizables del dashboard (estilo claro con tarjetas blancas).

type Variante = 'oro' | 'azul' | 'rojo' | 'verde' | 'gris'

// "oro" es la acción principal (lima), "azul" la oscura; los nombres se mantienen para no tocar cada pantalla
const VARIANTES: Record<Variante, string> = {
  oro: 'bg-lima text-tinta hover:brightness-95',
  azul: 'bg-tinta text-white hover:bg-black',
  rojo: 'bg-rose-50 text-alerta hover:bg-rose-100',
  verde: 'bg-emerald-500 text-white hover:bg-emerald-600',
  gris: 'bg-suave text-tinta hover:bg-linea'
}

export function Boton({
  variante = 'oro',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...props}
      className={`rounded-full px-5 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
    />
  )
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-linea bg-tarjeta p-4 ${className}`}>{children}</div>
}

// Pastilla con un punto del color del estado (o del cliente) y el fondo del mismo color muy suave
export function Etiqueta({ texto, color }: { texto: string; color: string }) {
  const suave = /^#[0-9a-f]{6}$/i.test(color) ? `${color}26` : 'var(--color-suave)'
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-tinta" style={{ background: suave }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {texto}
    </span>
  )
}

export function Titulo({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <h2 className="text-2xl leading-tight font-bold tracking-tight text-tinta">
      {color && <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: color }} />}
      {children}
    </h2>
  )
}

export function Subtitulo({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-semibold tracking-wider text-tinta-suave uppercase">{children}</p>
}

export const claseCampo =
  'w-full rounded-xl border border-linea bg-suave px-3 py-2 text-sm font-medium text-tinta outline-none transition focus:border-violeta focus:bg-white placeholder:text-tinta-suave/70'

export function Pantalla({ children }: { children: ReactNode }) {
  return <div className="h-full overflow-y-auto p-6">{children}</div>
}

export function Vacio({ texto }: { texto: string }) {
  return <p className="rounded-2xl border border-dashed border-linea p-4 text-center text-sm text-tinta-suave">{texto}</p>
}

// Foto redonda del empleado; si aún no tiene, su inicial sobre su color
export function Avatar({ nombre, color, foto, tam = 40 }: { nombre: string; color: string; foto: string | null; tam?: number }) {
  return foto ? (
    <img src={foto} alt={nombre} className="shrink-0 rounded-full bg-suave object-cover" style={{ width: tam, height: tam }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: tam, height: tam, background: color, fontSize: tam * 0.38 }}>
      {nombre.charAt(0)}
    </span>
  )
}
