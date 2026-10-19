import { ANCHO_OFICINA, FONDO_OFICINA, RADIO_ISLA, Z_OFICINA, zRio } from './medidas'

// Forma del terreno de la isla: colinas suaves, zona plana alrededor del edificio,
// un río tallado y playas que bajan al mar.

export const NIVEL_AGUA = -0.8

const suave = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

// Colinas grandes (posición x, z, altura, ancho)
const COLINAS: [number, number, number, number][] = [
  [-30, -26, 9, 13],
  [28, -28, 7, 12],
  [-38, 2, 4, 9],
  [36, 4, 3.5, 9],
  [0, -38, 5, 11]
]

// Bordes de la isla un poco irregulares
export const radioCosta = (x: number, z: number) => {
  const a = Math.atan2(z, x)
  return RADIO_ISLA + Math.sin(a * 3) * 2.5 + Math.cos(a * 5 + 1) * 1.8 + Math.sin(a * 9) * 0.8
}

// Plaza de asfalto alrededor del edificio (estilo Tilted Towers)
export const PLAZA = { xMin: -32, xMax: 32, zMin: -20, zMax: 12 }

const distPlaza = (x: number, z: number) => {
  const dx = Math.max(PLAZA.xMin - x, 0, x - PLAZA.xMax)
  const dz = Math.max(PLAZA.zMin - z, 0, z - PLAZA.zMax)
  return Math.hypot(dx, dz)
}

// Distancia al rectángulo del edificio (0 si estás encima)
const distEdificio = (x: number, z: number) => {
  const dx = Math.max(Math.abs(x) - ANCHO_OFICINA / 2, 0)
  const dz = Math.max(Math.abs(z - Z_OFICINA) - FONDO_OFICINA / 2, 0)
  return Math.hypot(dx, dz)
}

export function alturaTerreno(x: number, z: number): number {
  let h = Math.sin(x * 0.09) * Math.cos(z * 0.08) * 0.7 + Math.sin((x - z) * 0.05) * 0.5
  for (const [cx, cz, alto, ancho] of COLINAS) {
    const d2 = (x - cx) ** 2 + (z - cz) ** 2
    h += alto * Math.exp(-d2 / (2 * ancho * ancho))
  }

  // Plano bajo la plaza, y sube poco a poco fuera de ella
  h *= suave(1, 12, distPlaza(x, z))

  // Cauce del río
  const dRio = Math.abs(z - zRio(x))
  h = Math.min(h, -1.6 + (h + 1.6) * suave(2.6, 5.5, dRio))

  // Playa y caída al mar
  const r = Math.hypot(x, z)
  const costa = radioCosta(x, z)
  const caida = suave(costa - 7, costa + 3, r)
  h = h * (1 - caida) + -3.5 * caida

  return h
}

// ¿Es zona de arena (playa o camino)?
export function esArena(x: number, z: number): boolean {
  const r = Math.hypot(x, z)
  if (r > radioCosta(x, z) - 6) return true
  if (Math.abs(x) < 1.8 && z > Z_OFICINA + FONDO_OFICINA / 2 && z < radioCosta(x, z)) return true
  if (distEdificio(x, z) < 2.2) return true
  return false
}

// ¿Se puede poner un árbol o adorno aquí?
export function libre(x: number, z: number, margen = 0): boolean {
  const r = Math.hypot(x, z)
  if (r > radioCosta(x, z) - 8 - margen) return false
  if (distPlaza(x, z) < 2 + margen) return false
  // Pasillo libre delante del edificio: por aquí mira la cámara al entrar en un piso
  if (x > -12 && x < 24 && z > 12 && z < 42) return false
  if (Math.abs(z - zRio(x)) < 4.5 + margen) return false
  if (Math.abs(x) < 3 + margen && z > 0) return false
  for (const [cx, cz] of CASAS) if ((x - cx) ** 2 + (z - cz) ** 2 < (6 + margen) ** 2) return false
  return true
}

// Casitas de la isla (x, z)
export const CASAS: [number, number][] = [
  [-38, 8],
  [-14, -31],
  [24, 31]
]
