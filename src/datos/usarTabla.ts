import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type ConId = { id: string }

// Carga una tabla y la mantiene al día en tiempo real:
// si cambias algo en el Mac, aparece aquí sin recargar.
export function usarTabla<T extends ConId>(tabla: string, ordenarPor = 'creado_en') {
  const [filas, setFilas] = useState<T[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

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
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(canal)
    }
  }, [tabla, ordenarPor])

  return { filas, cargando, error }
}
