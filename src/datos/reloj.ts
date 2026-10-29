import { useEffect, useState } from 'react'

// Reloj compartido de toda la app: la hora de esta PC, al minuto.
// También dice el momento del día, para que más adelante el mapa pueda hacerse de noche.

export type MomentoDia = 'madrugada' | 'manana' | 'tarde' | 'noche'

export function momentoDelDia(fecha: Date): MomentoDia {
  const h = fecha.getHours()
  if (h < 6) return 'madrugada'
  if (h < 12) return 'manana'
  if (h < 19) return 'tarde'
  return 'noche'
}

export function usarReloj(): Date {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    let intervalo: ReturnType<typeof setInterval> | undefined
    // Espera al cambio de minuto y desde ahí avanza cada 60 s
    const espera = setTimeout(() => {
      setAhora(new Date())
      intervalo = setInterval(() => setAhora(new Date()), 60_000)
    }, 60_000 - (Date.now() % 60_000))
    return () => {
      clearTimeout(espera)
      clearInterval(intervalo)
    }
  }, [])
  return ahora
}
