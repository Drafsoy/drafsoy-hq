import * as THREE from 'three'
import { aleatorio } from './medidas'

// Texturas dibujadas por código, recreando los materiales de Tilted Towers.
// Se generan una vez y se reutilizan (con distinta repetición según el tamaño de cada pieza).

export type NombreTextura =
  | 'piedraGris'
  | 'piedraBeige'
  | 'piedraClara'
  | 'ladrillo'
  | 'adoquin'
  | 'asfalto'
  | 'losas'
  | 'tablasAzules'
  | 'tejas'
  | 'madera'
  | 'concreto'
  | 'roca'
  | 'toldoRojo'
  | 'toldoVerde'

const TAM = 512
const bases = new Map<NombreTextura, THREE.CanvasTexture>()
const copias = new Map<string, THREE.Texture>()

const hsl = (h: number, s: number, l: number) => `hsl(${h} ${s}% ${l}%)`

function ruido(ctx: CanvasRenderingContext2D, cantidad: number, alfa: number, semilla: number) {
  const azar = aleatorio(semilla)
  for (let i = 0; i < cantidad; i++) {
    const v = azar() > 0.5 ? 255 : 0
    ctx.fillStyle = `rgba(${v},${v},${v},${alfa * azar()})`
    ctx.fillRect(azar() * TAM, azar() * TAM, 1 + azar() * 2, 1 + azar() * 2)
  }
}

// Bloques en hiladas desplazadas (piedra, ladrillo)
function bloques(
  ctx: CanvasRenderingContext2D,
  o: { filas: number; cols: number; h: number; s: number; l: number; varL: number; mortero: string; junta: number; semilla: number }
) {
  const azar = aleatorio(o.semilla)
  ctx.fillStyle = o.mortero
  ctx.fillRect(0, 0, TAM, TAM)
  const alto = TAM / o.filas
  const ancho = TAM / o.cols
  for (let f = 0; f < o.filas; f++) {
    const desplazado = f % 2 ? ancho / 2 : 0
    for (let c = -1; c <= o.cols; c++) {
      const x = c * ancho + desplazado
      const y = f * alto
      const l = o.l + (azar() - 0.5) * o.varL
      ctx.fillStyle = hsl(o.h + (azar() - 0.5) * 6, o.s, l)
      ctx.fillRect(x + o.junta / 2, y + o.junta / 2, ancho - o.junta, alto - o.junta)
      // Borde iluminado arriba y sombra abajo: da relieve
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fillRect(x + o.junta / 2, y + o.junta / 2, ancho - o.junta, Math.max(2, alto * 0.08))
      ctx.fillStyle = 'rgba(0,0,0,0.16)'
      ctx.fillRect(x + o.junta / 2, y + alto - o.junta / 2 - Math.max(2, alto * 0.1), ancho - o.junta, Math.max(2, alto * 0.1))
    }
  }
  ruido(ctx, 9000, 0.12, o.semilla + 1)
}

const GENERADORES: Record<NombreTextura, (ctx: CanvasRenderingContext2D) => void> = {
  piedraGris: (ctx) => bloques(ctx, { filas: 8, cols: 3, h: 220, s: 6, l: 52, varL: 10, mortero: '#9ea3ab', junta: 5, semilla: 1 }),
  piedraBeige: (ctx) => bloques(ctx, { filas: 8, cols: 3, h: 40, s: 28, l: 74, varL: 8, mortero: '#efe6d2', junta: 5, semilla: 2 }),
  piedraClara: (ctx) => bloques(ctx, { filas: 10, cols: 3, h: 35, s: 10, l: 80, varL: 7, mortero: '#f4f1ea', junta: 4, semilla: 3 }),
  ladrillo: (ctx) => bloques(ctx, { filas: 18, cols: 6, h: 10, s: 48, l: 40, varL: 10, mortero: '#d6cbbf', junta: 5, semilla: 4 }),
  adoquin: (ctx) => bloques(ctx, { filas: 10, cols: 5, h: 10, s: 42, l: 46, varL: 10, mortero: '#c7b3a2', junta: 6, semilla: 5 }),
  losas: (ctx) => {
    ctx.fillStyle = '#c8ccd2'
    ctx.fillRect(0, 0, TAM, TAM)
    ruido(ctx, 12000, 0.08, 6)
    ctx.strokeStyle = '#9fa5ad'
    ctx.lineWidth = 4
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath()
      ctx.moveTo(0, (i * TAM) / 4)
      ctx.lineTo(TAM, (i * TAM) / 4)
      ctx.moveTo((i * TAM) / 4, 0)
      ctx.lineTo((i * TAM) / 4, TAM)
      ctx.stroke()
    }
  },
  asfalto: (ctx) => {
    ctx.fillStyle = '#5f646c'
    ctx.fillRect(0, 0, TAM, TAM)
    ruido(ctx, 30000, 0.18, 7)
    // Algunas grietas y manchas
    const azar = aleatorio(8)
    ctx.strokeStyle = 'rgba(40,40,45,0.35)'
    ctx.lineWidth = 2
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      let x = azar() * TAM
      let y = azar() * TAM
      ctx.moveTo(x, y)
      for (let k = 0; k < 5; k++) {
        x += (azar() - 0.5) * 60
        y += (azar() - 0.5) * 60
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  },
  tablasAzules: (ctx) => {
    const filas = 14
    const alto = TAM / filas
    for (let f = 0; f < filas; f++) {
      ctx.fillStyle = f % 2 ? '#5f95dc' : '#5a8fd6'
      ctx.fillRect(0, f * alto, TAM, alto)
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      ctx.fillRect(0, f * alto, TAM, 3)
      ctx.fillStyle = 'rgba(20,40,90,0.45)'
      ctx.fillRect(0, f * alto + alto - 5, TAM, 5)
    }
    ruido(ctx, 6000, 0.08, 9)
  },
  tejas: (ctx) => {
    ctx.fillStyle = '#6e4636'
    ctx.fillRect(0, 0, TAM, TAM)
    const azar = aleatorio(10)
    const filas = 12
    const alto = TAM / filas
    const ancho = TAM / 8
    for (let f = 0; f < filas; f++) {
      for (let c = -1; c <= 8; c++) {
        const x = c * ancho + (f % 2 ? ancho / 2 : 0)
        ctx.fillStyle = hsl(15, 30, 36 + (azar() - 0.5) * 8)
        ctx.beginPath()
        ctx.roundRect(x + 2, f * alto + 2, ancho - 4, alto + 6, [0, 0, 10, 10])
        ctx.fill()
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.fillRect(x + 2, f * alto + alto - 2, ancho - 4, 4)
      }
    }
  },
  madera: (ctx) => {
    const azar = aleatorio(11)
    const tablas = 8
    const ancho = TAM / tablas
    for (let i = 0; i < tablas; i++) {
      ctx.fillStyle = hsl(30, 45, 52 + (azar() - 0.5) * 10)
      ctx.fillRect(i * ancho, 0, ancho, TAM)
      ctx.fillStyle = 'rgba(80,40,10,0.35)'
      ctx.fillRect(i * ancho, 0, 3, TAM)
      ctx.fillRect(i * ancho, azar() * TAM, ancho, 3)
    }
    ruido(ctx, 8000, 0.1, 12)
  },
  concreto: (ctx) => {
    ctx.fillStyle = '#b3b7bd'
    ctx.fillRect(0, 0, TAM, TAM)
    ruido(ctx, 20000, 0.1, 13)
    ctx.strokeStyle = 'rgba(70,75,85,0.35)'
    ctx.lineWidth = 3
    ctx.strokeRect(2, 2, TAM - 4, TAM - 4)
    ctx.beginPath()
    ctx.moveTo(TAM / 2, 0)
    ctx.lineTo(TAM / 2, TAM)
    ctx.stroke()
  },
  roca: (ctx) => {
    ctx.fillStyle = '#8c8783'
    ctx.fillRect(0, 0, TAM, TAM)
    const azar = aleatorio(14)
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${azar() > 0.5 ? '255,255,255' : '30,25,25'},${0.08 + azar() * 0.1})`
      const y = azar() * TAM
      ctx.fillRect(0, y, TAM, 6 + azar() * 20)
    }
    ruido(ctx, 15000, 0.15, 15)
  },
  toldoRojo: (ctx) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#f8f9fa' : '#e03131'
      ctx.fillRect((i * TAM) / 8, 0, TAM / 8, TAM)
    }
  },
  toldoVerde: (ctx) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#f8f9fa' : '#2b8a3e'
      ctx.fillRect((i * TAM) / 8, 0, TAM / 8, TAM)
    }
  }
}

function base(nombre: NombreTextura): THREE.CanvasTexture {
  let t = bases.get(nombre)
  if (!t) {
    const lienzo = document.createElement('canvas')
    lienzo.width = lienzo.height = TAM
    GENERADORES[nombre](lienzo.getContext('2d')!)
    t = new THREE.CanvasTexture(lienzo)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    bases.set(nombre, t)
  }
  return t
}

// Textura con repetición (rx, ry). Las copias comparten la misma imagen.
export function textura(nombre: NombreTextura, rx = 1, ry = 1): THREE.Texture {
  const clave = `${nombre}:${rx.toFixed(2)}:${ry.toFixed(2)}`
  let t = copias.get(clave)
  if (!t) {
    t = base(nombre).clone()
    t.repeat.set(rx, ry)
    t.needsUpdate = true
    copias.set(clave, t)
  }
  return t
}

// Icono de cartel: emoji sobre un cuadrado de color (se dibuja con la fuente de emojis del sistema)
const iconos = new Map<string, THREE.CanvasTexture>()
export function texturaIcono(emoji: string, color: string): THREE.Texture {
  const clave = `${emoji}:${color}`
  let t = iconos.get(clave)
  if (!t) {
    const lienzo = document.createElement('canvas')
    lienzo.width = lienzo.height = 128
    const ctx = lienzo.getContext('2d')!
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(4, 4, 120, 120, 22)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(10, 10, 108, 10)
    ctx.font = '78px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, 64, 70)
    t = new THREE.CanvasTexture(lienzo)
    t.colorSpace = THREE.SRGBColorSpace
    iconos.set(clave, t)
  }
  return t
}
