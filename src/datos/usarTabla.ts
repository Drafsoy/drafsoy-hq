import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type ConId = { id: string }

const RECARGA_MS = 60_000

// Carga una tabla y la mantiene al día en tiempo real:
// si cambias algo en el Mac, aparece aquí sin recargar.
export function usarTabla<T extends ConId>(tabla: string, ordenarPor = 'creado_en') {
  const [filas, setFilas] = useState<T[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    const cargar = () =>
      supabase
        .from(tabla)
        .select('*')
        .order(ordenarPor, { ascending: true })
        .then(({ data, error }) => {
          if (!activo) return
          if (error) setError(error.message)
          else setFilas((data ?? []) as T[])
          setCargando(false)
        })
    cargar()
    // Red de seguridad: si la conexión en vivo se corta (p. ej. la PC se suspendió), se recarga cada minuto
    // y al volver a la ventana, para que la pantalla y el trabajo automático no se queden con datos viejos
    const intervalo = setInterval(cargar, RECARGA_MS)
    window.addEventListener('focus', cargar)

    const canal = supabase
      .channel(`${tabla}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tabla }, (cambio) => {
        setFilas((actuales) => {
          if (cambio.eventType === 'INSERT') {
            const nueva = cambio.new as T
            return actuales.some((f) => f.id === nueva.id) ? actuales : [...actuales, nueva]
          }
          if (cambio.eventType === 'UPDATE') {
            // Supabase no reenvía los textos largos que no cambiaron: se mezclan con lo que ya teníamos
            const nueva = cambio.new as T
            return actuales.map((f) => (f.id === nueva.id ? { ...f, ...nueva } : f))
          }
          const vieja = cambio.old as Partial<T>
          return actuales.filter((f) => f.id !== vieja.id)
        })
      })
      .subscribe((estado) => {
        // Al reconectarse se recarga todo: lo que cambió mientras estaba caída no llega por el canal
        if (estado === 'SUBSCRIBED') cargar()
      })

    return () => {
      activo = false
      clearInterval(intervalo)
      window.removeEventListener('focus', cargar)
      supabase.removeChannel(canal)
    }
  }, [tabla, ordenarPor])

  return { filas, cargando, error }
}
