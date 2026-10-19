import * as THREE from 'three'
import type { Agente } from '@/datos/tipos'

// Skins de los personajes (minifiguras LEGO). Cada skin define colores, peinado, cara y
// el estampado del torso (delante y detrás).

export interface Skin {
  piel: string
  pelo: string
  peinado: 'basico' | 'barrido' | 'trenzasGorra'
  cara: 'sonrisa' | 'picara' | 'alegre'
  gorra?: string
  torso: string
  torsoMapa?: THREE.Texture // estampado envolvente: [lado der., espalda, lado izq., frente]
  brazos: string
  manga?: string // si hay manga corta, el antebrazo es de piel
  manos: string
  cadera: string
  piernas: string
  detallePiernas?: string
  pies?: string // puntera de las zapatillas
  tatuaje?: string // color del tatuaje en el brazo derecho
}

const PIEL_LEGO = '#ffd23f'

// ---------- Jonesy (LEGO Fortnite) ----------

function torsoJonesy(): THREE.Texture {
  const W = 1024
  const H = 256
  const lienzo = document.createElement('canvas')
  lienzo.width = W
  lienzo.height = H
  const c = lienzo.getContext('2d')!
  const panel = W / 4

  // Laterales verde oliva
  c.fillStyle = '#5f7a3c'
  c.fillRect(0, 0, W, H)

  // ---- Espalda (2º panel): verde oscuro camuflaje, correas grises y cinturón marrón ----
  const xe = panel
  c.fillStyle = '#2f5d34'
  c.fillRect(xe, 0, panel, H)
  c.fillStyle = '#a7c957'
  for (const [x, y, r] of [
    [0.2, 0.2, 10],
    [0.75, 0.25, 12],
    [0.3, 0.6, 9],
    [0.8, 0.65, 11],
    [0.55, 0.4, 7]
  ] as const) {
    c.beginPath()
    c.ellipse(xe + x * panel, y * H, r, r * 0.7, 0.5, 0, Math.PI * 2)
    c.fill()
  }
  c.strokeStyle = '#8e99a5'
  c.lineWidth = 22
  c.beginPath()
  c.moveTo(xe + 0.15 * panel, 0.05 * H)
  c.lineTo(xe + 0.85 * panel, 0.72 * H)
  c.moveTo(xe + 0.85 * panel, 0.05 * H)
  c.lineTo(xe + 0.6 * panel, 0.3 * H)
  c.stroke()
  c.fillStyle = '#cfe2f3'
  c.fillRect(xe + 0.42 * panel, 0.38 * H, 40, 26)
  c.fillStyle = '#7a4a26'
  c.fillRect(xe, 0.84 * H, panel, 0.16 * H)
  c.fillStyle = '#e8742a'
  for (const x of [0.15, 0.48, 0.8]) c.fillRect(xe + x * panel, 0.83 * H, 18, 0.18 * H)

  // ---- Frente (4º panel): chaleco oliva con arnés negro y cuello naranja ----
  const xf = panel * 3
  c.fillStyle = '#7d8c3c'
  c.fillRect(xf, 0, panel, H)
  // Cuello naranja en V
  c.fillStyle = '#e8742a'
  c.beginPath()
  c.moveTo(xf + 0.36 * panel, 0)
  c.lineTo(xf + 0.64 * panel, 0)
  c.lineTo(xf + 0.5 * panel, 0.2 * H)
  c.closePath()
  c.fill()
  // Tirantes del arnés
  c.fillStyle = '#1c1c1c'
  c.fillRect(xf + 0.2 * panel, 0, 0.12 * panel, 0.35 * H)
  c.fillRect(xf + 0.68 * panel, 0, 0.12 * panel, 0.35 * H)
  // Chaleco táctico (bloque negro con bolsillos)
  c.beginPath()
  c.roundRect(xf + 0.18 * panel, 0.3 * H, 0.64 * panel, 0.5 * H, 10)
  c.fill()
  c.fillStyle = '#3b3b3b'
  for (const [x, y] of [
    [0.24, 0.38],
    [0.52, 0.38],
    [0.24, 0.58],
    [0.52, 0.58]
  ] as const) {
    c.beginPath()
    c.roundRect(xf + x * panel, y * H, 0.22 * panel, 0.15 * H, 4)
    c.fill()
  }
  // Pespuntes blancos
  c.fillStyle = '#dcdcdc'
  for (let i = 0; i < 8; i++) c.fillRect(xf + (0.22 + i * 0.075) * panel, 0.33 * H, 6, 3)
  // Correas colgando a los lados
  c.fillStyle = '#1c1c1c'
  c.fillRect(xf + 0.06 * panel, 0.55 * H, 0.08 * panel, 0.3 * H)
  c.fillRect(xf + 0.86 * panel, 0.55 * H, 0.08 * panel, 0.3 * H)
  // Cinturón oscuro con remaches
  c.fillStyle = '#2a2a2a'
  c.fillRect(xf, 0.86 * H, panel, 0.14 * H)
  c.fillStyle = '#d9b44a'
  for (let i = 0; i < 6; i++) c.fillRect(xf + (0.1 + i * 0.15) * panel, 0.91 * H, 8, 8)

  const t = new THREE.CanvasTexture(lienzo)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// ---------- Aura (LEGO Fortnite) ----------

function torsoAura(): THREE.Texture {
  const W = 1024
  const H = 256
  const lienzo = document.createElement('canvas')
  lienzo.width = W
  lienzo.height = H
  const c = lienzo.getContext('2d')!
  const panel = W / 4
  const corte = 0.6 * H // donde acaba el top y empieza el pantalón

  // Top gris acanalado por todo el contorno
  c.fillStyle = '#c9cbcf'
  c.fillRect(0, 0, W, corte)
  c.strokeStyle = 'rgba(90,95,105,0.45)'
  c.lineWidth = 3
  for (let x = 6; x < W; x += 14) {
    c.beginPath()
    c.moveTo(x, 0.12 * H)
    c.lineTo(x, corte)
    c.stroke()
  }
  // Cuello alto con rayas horizontales
  c.fillStyle = '#b3b6bb'
  c.fillRect(0, 0, W, 0.1 * H)
  // Banda roja
  c.fillStyle = '#c92a2a'
  c.fillRect(0, 0.3 * H, W, 0.1 * H)
  c.fillStyle = '#8f1d1d'
  for (let x = 0; x < W; x += 40) c.fillRect(x, 0.3 * H, 4, 0.1 * H)
  // Parte baja negra (cintura del pantalón) con cinturón
  c.fillStyle = '#1e1f22'
  c.fillRect(0, corte, W, H - corte)
  c.fillStyle = '#4a4d52'
  c.fillRect(0, corte + 0.08 * H, W, 0.06 * H)
  // Hebilla y adornos al frente
  const xf = panel * 3
  c.strokeStyle = '#8e9196'
  c.lineWidth = 5
  c.strokeRect(xf + 0.42 * panel, corte + 0.05 * H, 0.16 * panel, 0.12 * H)
  c.beginPath()
  c.arc(xf + 0.2 * panel, H, 0.16 * panel, Math.PI, Math.PI * 1.6)
  c.arc(xf + 0.8 * panel, H, 0.16 * panel, Math.PI * 1.4, Math.PI * 2)
  c.stroke()
  // Cadena dorada al cuello (solo delante)
  c.strokeStyle = '#e3b23c'
  c.lineWidth = 7
  for (let i = 0; i < 7; i++) {
    const t = i / 6
    const x = xf + (0.15 + t * 0.7) * panel
    const y = 0.13 * H + Math.sin(t * Math.PI) * 0.1 * H
    c.beginPath()
    c.ellipse(x, y, 13, 8, i % 2 ? 0.5 : -0.5, 0, Math.PI * 2)
    c.stroke()
  }

  const t = new THREE.CanvasTexture(lienzo)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

let texturaAura: THREE.Texture | null = null
let texturaJonesy: THREE.Texture | null = null

const PRESETS: Record<string, () => Skin> = {
  jonesy: () => ({
    piel: '#f3cfa8',
    pelo: '#f4c430',
    peinado: 'barrido',
    cara: 'picara',
    torso: '#ffffff',
    torsoMapa: (texturaJonesy ??= torsoJonesy()),
    brazos: '#f3cfa8',
    manga: '#8d9196',
    manos: '#1e1e1e',
    cadera: '#8a744a',
    piernas: '#a38b5c',
    detallePiernas: '#5c4a2e'
  }),
  aura: () => ({
    piel: '#d99a6c',
    pelo: '#b4562a',
    peinado: 'trenzasGorra',
    gorra: '#f2a900',
    cara: 'alegre',
    torso: '#ffffff',
    torsoMapa: (texturaAura ??= torsoAura()),
    brazos: '#d99a6c',
    manos: '#1e1e1e',
    cadera: '#1e1f22',
    piernas: '#232428',
    detallePiernas: '#6c7078',
    pies: '#f2a900',
    tatuaje: '#2b2b2b'
  })
}

export const SKINS_DISPONIBLES = Object.keys(PRESETS)

// Skin de un agente: la del campo "Skin 3D" si existe; si no, la de su nombre; si no, la clásica.
export function skinDe(agente: Agente, pelo: string, piernas: string): Skin {
  const clave = (agente.skin_modelo ?? '').trim().toLowerCase() || agente.nombre.trim().toLowerCase()
  const preset = PRESETS[clave]
  if (preset) return preset()
  return {
    piel: PIEL_LEGO,
    pelo,
    peinado: 'basico',
    cara: 'sonrisa',
    torso: agente.color,
    brazos: agente.color,
    manos: PIEL_LEGO,
    cadera: piernas,
    piernas
  }
}
