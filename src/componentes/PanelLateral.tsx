import type { ReactNode } from 'react'
import { usarRuta } from '@/navegacion'

// Panel que se abre sobre el mundo 3D (la isla sigue viva detrás).
export default function PanelLateral({ ancho, children }: { ancho: number; children: ReactNode }) {
  const { ir } = usarRuta()
  return (
    <div className="panel-juego entrar-derecha absolute z-40 top-4 right-4 bottom-4 flex flex-col overflow-hidden" style={{ width: ancho }}>
      <button
        onClick={() => ir({ pantalla: 'mundo' })}
        title="Volver al mundo"
        className="titulo-juego absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg border-2 border-white/40 bg-black/40 text-lg text-white transition hover:bg-alerta"
      >
        ✕
      </button>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
