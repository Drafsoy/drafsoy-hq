import { createContext, useContext } from 'react'

export type Ruta =
  | { pantalla: 'mundo' }
  | { pantalla: 'cliente'; id: string }
  | { pantalla: 'agente'; id: string }
  | { pantalla: 'bandeja' }
  | { pantalla: 'chat' }
  | { pantalla: 'ajustes' }
  | { pantalla: 'nuevoAgente' }
  | { pantalla: 'nuevoCliente' }

export const ContextoRuta = createContext<{ ruta: Ruta; ir: (ruta: Ruta) => void }>({
  ruta: { pantalla: 'mundo' },
  ir: () => {}
})

export const usarRuta = () => useContext(ContextoRuta)
