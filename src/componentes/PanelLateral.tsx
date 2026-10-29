import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { usarRuta } from '@/navegacion'

// Tarjeta grande que ocupa la columna derecha cuando abres una ficha, el chat, la bandeja…
export default function PanelLateral({ ancho, children }: { ancho: number; children: ReactNode }) {
  const { ir } = usarRuta()
  return (
    <div className="tarjeta entrar-derecha relative flex shrink-0 flex-col overflow-hidden" style={{ width: ancho, maxWidth: '58%' }}>
      <button
        onClick={() => ir({ pantalla: 'mundo' })}
        title="Cerrar"
        className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-suave text-tinta-suave transition hover:bg-linea hover:text-tinta"
      >
        <X size={18} />
      </button>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
