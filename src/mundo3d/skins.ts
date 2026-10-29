import * as THREE from 'three'
import type { Agente } from '@/datos/tipos'

// Skins de los personajes (minifiguras LEGO). Cada skin define colores, peinado, cara y
// el estampado del torso (delante y detrás).

export interface Skin {
  piel: string
  pelo: string
  peinado: 'basico' | 'barrido' | 'trenzasGorra' | 'pez' | 'mono' | 'melena' | 'engominado' | 'capucha' | 'pato' | 'alien' | 'despeinado'
  cara: 'sonrisa' | 'picara' | 'alegre' | 'pez' | 'gafas' | 'delineado' | 'cicatriz' | 'perro' | 'pato' | 'alien' | 'mascara'
  cabeza?: 'esfera' | 'alien' // cabeza redonda u ovalada en vez del cilindro LEGO
  gorra?: string // gorra, sombrero o capucha
  gafas?: string // montura de las gafas
  collar?: string // gargantilla
  bufanda?: string // bufanda gruesa al cuello (con la cola por detrás)
  torso: string
  torsoMapa?: THREE.Texture // estampado envolvente: [lado der., espalda, lado izq., frente]
  brazos: string
  manga?: string // si hay manga corta, el antebrazo es de piel
  manos: string
  manosMetal?: boolean // manos doradas brillantes
  cadera: string
  piernas: string
  piernasMapa?: THREE.Texture // estampado de las piernas (camuflaje, bolsillos…)
  detallePiernas?: string
  botas?: string // caña de las botas (parte baja de la pierna)
  pies?: string // puntera de las zapatillas
  tatuaje?: string // color del tatuaje en el brazo derecho
}

const PIEL_LEGO = '#ffd23f'

// ---------- Aura ----------

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
  // Cadena dorada al cuello (delante y detrás)
  c.strokeStyle = '#e3b23c'
  c.lineWidth = 7
  for (let i = 0; i < 14; i++) {
    const t = (i % 7) / 6
    const x = (i < 7 ? xf : panel) + (0.15 + t * 0.7) * panel
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

// Lienzo para estampados: el torso usa 1024x256 con 4 paneles [lado der., espalda, lado izq., frente]
function textura(dibujar: (c: CanvasRenderingContext2D, panel: number, H: number) => void, W = 1024, H = 256): THREE.Texture {
  const lienzo = document.createElement('canvas')
  lienzo.width = W
  lienzo.height = H
  const c = lienzo.getContext('2d')!
  dibujar(c, W / 4, H)
  const t = new THREE.CanvasTexture(lienzo)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// Línea quebrada con el trazo actual (coordenadas relativas al panel)
function trazo(c: CanvasRenderingContext2D, x0: number, panel: number, H: number, puntos: [number, number][]) {
  c.beginPath()
  puntos.forEach(([x, y], i) => (i ? c.lineTo(x0 + x * panel, y * H) : c.moveTo(x0 + x * panel, y * H)))
  c.stroke()
}

function poligono(c: CanvasRenderingContext2D, x0: number, panel: number, H: number, puntos: [number, number][]) {
  c.beginPath()
  puntos.forEach(([x, y], i) => (i ? c.lineTo(x0 + x * panel, y * H) : c.moveTo(x0 + x * panel, y * H)))
  c.closePath()
  c.fill()
}

// ---------- Jonesy: camiseta verde sin mangas, pañuelo y correa ----------

function torsoJonesy(): THREE.Texture {
  return textura((c, panel, H) => {
    const xe = panel
    const xf = panel * 3
    c.fillStyle = '#2f7a3e'
    c.fillRect(0, 0, panel * 4, H)
    // Espalda: correas cruzadas y la punta del pañuelo
    c.strokeStyle = '#6b3f1f'
    c.lineWidth = 20
    trazo(c, xe, panel, H, [[0.15, 0], [0.85, 0.8]])
    trazo(c, xe, panel, H, [[0.85, 0], [0.15, 0.8]])
    c.fillStyle = '#8fcfb4'
    poligono(c, xe, panel, H, [[0.3, 0], [0.7, 0], [0.5, 0.22]])
    // Frente: correa en diagonal, tirante, pañuelo y bolsillo
    trazo(c, xf, panel, H, [[0.12, 0], [0.88, 0.78]])
    trazo(c, xf, panel, H, [[0.82, 0], [0.82, 0.8]])
    poligono(c, xf, panel, H, [[0.18, 0], [0.82, 0], [0.45, 0.42]])
    c.strokeStyle = '#1f3d2a'
    c.lineWidth = 4
    trazo(c, xf, panel, H, [[0.18, 0], [0.45, 0.42], [0.82, 0]])
    c.strokeRect(xf + 0.58 * panel, 0.45 * H, 0.16 * panel, 0.16 * H)
    // Cinturón marrón con trabillas y hebilla gris, todo alrededor
    c.fillStyle = '#6b3f1f'
    c.fillRect(0, 0.84 * H, panel * 4, 0.12 * H)
    c.fillStyle = '#efe3c2'
    for (let x = 30; x < panel * 4; x += 70) c.fillRect(x, 0.8 * H, 8, 0.18 * H)
    c.fillStyle = '#9aa0a6'
    c.fillRect(xf + 0.42 * panel, 0.82 * H, 0.16 * panel, 0.15 * H)
  })
}

function camuflajeJonesy(): THREE.Texture {
  return textura(
    (c, _panel, H) => {
      c.fillStyle = '#efdcb0'
      c.fillRect(0, 0, H, H)
      const colores = ['#e8a07a', '#f2c49b', '#d98a64']
      let semilla = 7
      const azar = () => (semilla = (semilla * 9301 + 49297) % 233280) / 233280
      for (let i = 0; i < 110; i++) {
        c.fillStyle = colores[i % 3]
        c.fillRect(Math.floor(azar() * 16) * 16, Math.floor(azar() * 16) * 16, 16 + Math.floor(azar() * 3) * 16, 16)
      }
    },
    256,
    256
  )
}

// ---------- Palito de pescado: impermeable amarillo ----------

function torsoPalito(): THREE.Texture {
  return textura((c, panel, H) => {
    const xf = panel * 3
    c.fillStyle = '#f2c230'
    c.fillRect(0, 0, panel * 4, H)
    // Cuello alto y bajo más oscuros
    c.fillStyle = '#d9a91f'
    c.fillRect(0, 0, panel * 4, 0.1 * H)
    c.fillRect(0, 0.9 * H, panel * 4, 0.1 * H)
    // Costura de la espalda y cierre central
    c.fillStyle = '#c99a1a'
    c.fillRect(panel * 1.1, 0.3 * H, panel * 0.8, 5)
    c.fillRect(xf + 0.48 * panel, 0.1 * H, 8, 0.8 * H)
    // Botones de madera
    c.fillStyle = '#7a4a26'
    for (const y of [0.25, 0.45, 0.65]) {
      c.beginPath()
      c.roundRect(xf + 0.4 * panel, y * H, 0.2 * panel, 0.07 * H, 6)
      c.fill()
    }
    // Bolsillos con solapa
    c.strokeStyle = '#b8870f'
    c.lineWidth = 5
    c.fillStyle = '#d9a91f'
    for (const x of [0.1, 0.64]) {
      c.strokeRect(xf + x * panel, 0.6 * H, 0.26 * panel, 0.22 * H)
      c.fillRect(xf + x * panel, 0.6 * H, 0.26 * panel, 0.07 * H)
    }
  })
}

// ---------- Novata: camisa blanca, chaleco turquesa y credencial ----------

function torsoNovata(): THREE.Texture {
  return textura((c, panel, H) => {
    const xf = panel * 3
    c.fillStyle = '#2a9d8f'
    c.fillRect(0, 0, panel * 4, H)
    // Camisa blanca en V con cuello
    c.fillStyle = '#f4f4f4'
    poligono(c, xf, panel, H, [[0.28, 0], [0.72, 0], [0.5, 0.5]])
    c.strokeStyle = '#c9c9c9'
    c.lineWidth = 3
    trazo(c, xf, panel, H, [[0.3, 0], [0.42, 0.16], [0.5, 0.04], [0.58, 0.16], [0.7, 0]])
    // Botones del chaleco
    c.fillStyle = '#1d5f57'
    for (const y of [0.58, 0.7, 0.82]) {
      c.beginPath()
      c.arc(xf + 0.5 * panel, y * H, 6, 0, Math.PI * 2)
      c.fill()
    }
    // Cinta y credencial
    c.strokeStyle = '#1f4e9c'
    c.lineWidth = 5
    trazo(c, xf, panel, H, [[0.36, 0], [0.62, 0.42]])
    trazo(c, xf, panel, H, [[0.64, 0], [0.7, 0.42]])
    c.fillStyle = '#ffffff'
    c.fillRect(xf + 0.56 * panel, 0.42 * H, 0.22 * panel, 0.22 * H)
    c.fillStyle = '#1f4e9c'
    c.fillRect(xf + 0.56 * panel, 0.42 * H, 0.22 * panel, 0.06 * H)
    c.fillStyle = '#9aa0a6'
    c.fillRect(xf + 0.6 * panel, 0.53 * H, 0.14 * panel, 4)
    c.fillRect(xf + 0.6 * panel, 0.58 * H, 0.1 * panel, 4)
    // Tira ajustable en la espalda
    c.fillStyle = '#23867a'
    c.fillRect(panel * 1.2, 0.7 * H, panel * 0.6, 0.06 * H)
  })
}

// ---------- Neblina: sudadera morada con luna ----------

function torsoNeblina(): THREE.Texture {
  return textura((c, panel, H) => {
    const xe = panel
    const xf = panel * 3
    c.fillStyle = '#6c4ab6'
    c.fillRect(0, 0, panel * 4, H)
    // Capucha caída en la espalda y puño elástico abajo
    c.fillStyle = '#563a96'
    c.beginPath()
    c.ellipse(xe + 0.5 * panel, 0, 0.4 * panel, 0.35 * H, 0, 0, Math.PI)
    c.fill()
    c.fillRect(0, 0.88 * H, panel * 4, 0.12 * H)
    // Cordones
    c.strokeStyle = '#f1ecff'
    c.lineWidth = 5
    trazo(c, xf, panel, H, [[0.4, 0], [0.4, 0.3]])
    trazo(c, xf, panel, H, [[0.6, 0], [0.6, 0.3]])
    // Luna menguante y estrellitas
    c.fillStyle = '#ffd166'
    c.beginPath()
    c.arc(xf + 0.5 * panel, 0.45 * H, 0.12 * panel, 0, Math.PI * 2)
    c.fill()
    for (const [x, y] of [[0.7, 0.3], [0.28, 0.34], [0.74, 0.54]] as const) c.fillRect(xf + x * panel, y * H, 6, 6)
    c.fillStyle = '#6c4ab6'
    c.beginPath()
    c.arc(xf + 0.56 * panel, 0.41 * H, 0.1 * panel, 0, Math.PI * 2)
    c.fill()
    // Bolsillo canguro
    c.fillStyle = '#5b3ea0'
    poligono(c, xf, panel, H, [[0.22, 0.88], [0.3, 0.64], [0.7, 0.64], [0.78, 0.88]])
  })
}

// ---------- Midas: chaleco negro, camisa blanca y corbata ----------

function torsoMidas(): THREE.Texture {
  return textura((c, panel, H) => {
    const xe = panel
    const xf = panel * 3
    c.fillStyle = '#1d1f22'
    c.fillRect(0, 0, panel * 4, H)
    // Espalda gris con tirantes
    c.fillStyle = '#4a4d52'
    c.fillRect(xe, 0, panel, H)
    c.strokeStyle = '#26282b'
    c.lineWidth = 10
    trazo(c, xe, panel, H, [[0.2, 0], [0.5, 0.35], [0.8, 0]])
    trazo(c, xe, panel, H, [[0.5, 0.35], [0.5, 0.85]])
    // Camisa blanca en V y corbata
    c.fillStyle = '#f4f4f4'
    poligono(c, xf, panel, H, [[0.3, 0], [0.7, 0], [0.5, 0.45]])
    c.fillStyle = '#0c0c0c'
    poligono(c, xf, panel, H, [[0.46, 0.05], [0.54, 0.05], [0.56, 0.4], [0.5, 0.46], [0.44, 0.4]])
    // Solapas, botones y bolsillos del chaleco
    c.strokeStyle = '#8e9196'
    c.lineWidth = 3
    trazo(c, xf, panel, H, [[0.3, 0], [0.5, 0.5], [0.7, 0]])
    trazo(c, xf, panel, H, [[0.5, 0.5], [0.5, 0.92]])
    c.fillStyle = '#8e9196'
    for (const y of [0.58, 0.7, 0.82]) {
      c.beginPath()
      c.arc(xf + 0.54 * panel, y * H, 5, 0, Math.PI * 2)
      c.fill()
    }
    for (const x of [0.14, 0.62]) c.fillRect(xf + x * panel, 0.68 * H, 0.22 * panel, 4)
    // Ribetes dorados
    c.fillStyle = '#e0a82e'
    for (const x of [0.16, 0.7]) c.fillRect(xf + x * panel, 0.38 * H, 0.14 * panel, 0.05 * H)
  })
}

// ---------- Blue: sudadera blanca con capucha ----------

function torsoBlue(): THREE.Texture {
  return textura((c, panel, H) => {
    const xe = panel
    const xf = panel * 3
    c.fillStyle = '#f5f5f5'
    c.fillRect(0, 0, panel * 4, H)
    c.fillStyle = '#9aa0a6'
    c.fillRect(0, 0.9 * H, panel * 4, 5)
    // Espalda: rayas tipo código
    c.fillStyle = '#222'
    for (let i = 0; i < 9; i++) {
      const ancho = 0.2 + ((i * 37) % 5) * 0.06
      c.fillRect(xe + (0.5 - ancho / 2) * panel, (0.18 + i * 0.075) * H, ancho * panel, 0.035 * H)
    }
    // Cordones y bolsillo canguro
    c.strokeStyle = '#9aa0a6'
    c.lineWidth = 4
    trazo(c, xf, panel, H, [[0.42, 0], [0.42, 0.3]])
    trazo(c, xf, panel, H, [[0.58, 0], [0.58, 0.3]])
    trazo(c, xf, panel, H, [[0.24, 0.88], [0.32, 0.64], [0.68, 0.64], [0.76, 0.88]])
    // Rótulo de la casa
    c.fillStyle = '#1e1e1e'
    c.textAlign = 'center'
    c.font = 'bold 34px Arial, sans-serif'
    c.fillText('DRAFSOY', xf + 0.5 * panel, 0.46 * H)
    c.font = 'bold 14px Arial, sans-serif'
    c.fillText('H  Q', xf + 0.5 * panel, 0.55 * H)
  })
}

function cargoBlue(): THREE.Texture {
  return textura(
    (c, _panel, H) => {
      c.fillStyle = '#1f2023'
      c.fillRect(0, 0, H, H)
      c.strokeStyle = '#8e9196'
      c.lineWidth = 4
      c.strokeRect(0.22 * H, 0.3 * H, 0.56 * H, 0.32 * H)
      c.strokeRect(0.22 * H, 0.3 * H, 0.56 * H, 0.1 * H)
      c.fillStyle = '#8e9196'
      c.fillRect(0, 0.82 * H, H, 3)
    },
    256,
    256
  )
}

// ---------- Cluster: polo turquesa con cuello de colores ----------

function torsoCluster(): THREE.Texture {
  return textura((c, panel, H) => {
    const xe = panel
    const xf = panel * 3
    const colores = ['#e63946', '#ffd166', '#1d3557', '#f4a261']
    c.fillStyle = '#1fb5a8'
    c.fillRect(0, 0, panel * 4, H)
    // Cuello estampado: en V delante y como banda detrás
    c.fillStyle = '#ffd23f'
    poligono(c, xf, panel, H, [[0.3, 0], [0.7, 0], [0.5, 0.26]])
    c.strokeStyle = '#1d1d1d'
    c.lineWidth = 16
    trazo(c, xf, panel, H, [[0.2, 0], [0.5, 0.3], [0.8, 0]])
    c.beginPath()
    c.ellipse(xe + 0.5 * panel, 0, 0.32 * panel, 0.08 * H, 0, 0, Math.PI)
    c.stroke()
    for (let i = 0; i < 10; i++) {
      const t = i / 9
      const x = 0.2 + t * 0.6
      const y = (t < 0.5 ? t : 1 - t) * 0.6
      c.fillStyle = colores[i % 4]
      c.fillRect(xf + x * panel - 4, y * H - 4, 8, 8)
    }
    // Parche en el pecho
    c.fillStyle = '#1d1d1d'
    c.fillRect(xf + 0.12 * panel, 0.42 * H, 0.24 * panel, 0.08 * H)
    for (let i = 0; i < 4; i++) {
      c.fillStyle = colores[i]
      c.fillRect(xf + (0.14 + i * 0.055) * panel, 0.44 * H, 8, 0.04 * H)
    }
    // Cintura blanca con cinturón negro y hebilla dorada
    c.fillStyle = '#f5f5f5'
    c.fillRect(0, 0.86 * H, panel * 4, 0.14 * H)
    c.fillStyle = '#1d1d1d'
    c.fillRect(0, 0.89 * H, panel * 4, 0.07 * H)
    c.fillStyle = '#e0a82e'
    c.fillRect(xf + 0.44 * panel, 0.87 * H, 0.12 * panel, 0.11 * H)
  })
}

// ---------- Mariano: alien azul en bañador de plátanos ----------

function torsoMariano(): THREE.Texture {
  return textura((c, panel, H) => {
    const xf = panel * 3
    c.fillStyle = '#45c3e0'
    c.fillRect(0, 0, panel * 4, H)
    // Pectorales y clavícula
    c.strokeStyle = '#1f5f8f'
    c.lineWidth = 4
    c.beginPath()
    c.arc(xf + 0.32 * panel, 0.4 * H, 0.16 * panel, Math.PI * 0.15, Math.PI * 0.85)
    c.stroke()
    c.beginPath()
    c.arc(xf + 0.68 * panel, 0.4 * H, 0.16 * panel, Math.PI * 0.15, Math.PI * 0.85)
    c.stroke()
    trazo(c, xf, panel, H, [[0.45, 0.06], [0.5, 0.1], [0.55, 0.06]])
    // Cintura del bañador asomando abajo
    c.fillStyle = '#ffd93b'
    c.fillRect(0, 0.92 * H, panel * 4, 0.08 * H)
  })
}

function platanos(): THREE.Texture {
  return textura(
    (c, _panel, H) => {
      c.fillStyle = '#ffd93b'
      c.fillRect(0, 0, H, H)
      c.fillStyle = '#f2b51e'
      for (let x = 8; x < H; x += 22) for (let y = 8; y < H; y += 22) c.fillRect(x, y, 4, 4)
      c.strokeStyle = '#1d1d1d'
      c.lineWidth = 5
      for (const [x, y, giro] of [[0.3, 0.3, 0.4], [0.72, 0.55, -0.6], [0.35, 0.8, 1.2]] as const) {
        c.save()
        c.translate(x * H, y * H)
        c.rotate(giro)
        c.fillStyle = '#ffe680'
        c.beginPath()
        c.arc(0, -30, 40, Math.PI * 0.2, Math.PI * 0.8)
        c.arc(0, -40, 34, Math.PI * 0.75, Math.PI * 0.25, true)
        c.closePath()
        c.fill()
        c.stroke()
        c.fillStyle = '#1d1d1d'
        c.fillRect(-8, -2, 4, 4)
        c.fillRect(4, -2, 4, 4)
        c.restore()
      }
    },
    256,
    256
  )
}

// ---------- Deriva: chaqueta magenta con capucha ----------

function torsoDeriva(): THREE.Texture {
  return textura((c, panel, H) => {
    const xe = panel
    const xf = panel * 3
    c.fillStyle = '#c0207f'
    c.fillRect(0, 0, panel * 4, H)
    // Cintura negra con franja blanca
    c.fillStyle = '#1c1c1f'
    c.fillRect(0, 0.86 * H, panel * 4, 0.14 * H)
    c.fillStyle = '#f2f2f2'
    c.fillRect(0, 0.84 * H, panel * 4, 0.04 * H)
    // Espalda: dos franjas negras en diagonal
    c.strokeStyle = '#1c1c1f'
    c.lineWidth = 12
    trazo(c, xe, panel, H, [[0.2, 0.1], [0.45, 0.8]])
    trazo(c, xe, panel, H, [[0.8, 0.1], [0.55, 0.8]])
    // Frente: cremallera, cuello, bolsillo de pecho con cierre amarillo y bolsillo con solapa
    c.lineWidth = 4
    trazo(c, xf, panel, H, [[0.5, 0], [0.5, 0.84]])
    trazo(c, xf, panel, H, [[0.3, 0], [0.42, 0.14], [0.5, 0.06], [0.58, 0.14], [0.7, 0]])
    c.strokeRect(xf + 0.6 * panel, 0.22 * H, 0.2 * panel, 0.3 * H)
    c.fillStyle = '#f5b301'
    c.fillRect(xf + 0.68 * panel, 0.25 * H, 6, 0.22 * H)
    c.strokeRect(xf + 0.12 * panel, 0.52 * H, 0.28 * panel, 0.24 * H)
    trazo(c, xf, panel, H, [[0.12, 0.6], [0.4, 0.6]])
  })
}

function pantalonDeriva(): THREE.Texture {
  return textura(
    (c, _panel, H) => {
      c.fillStyle = '#1c1c1f'
      c.fillRect(0, 0, H, H)
      c.fillStyle = '#c0207f'
      c.fillRect(0.55 * H, 0.18 * H, 0.18 * H, 0.08 * H)
      c.fillStyle = '#f2f2f2'
      c.beginPath()
      c.moveTo(0, 0.7 * H)
      c.lineTo(0.45 * H, 0.62 * H)
      c.lineTo(0.6 * H, 0.78 * H)
      c.lineTo(0, 0.86 * H)
      c.fill()
      c.strokeStyle = '#6b6f78'
      c.lineWidth = 3
      c.strokeRect(0.15 * H, 0.3 * H, 0.35 * H, 0.22 * H)
    },
    256,
    256
  )
}

// ---------- Rubius: camiseta blanca y vaqueros ----------

function torsoRubius(): THREE.Texture {
  return textura((c, panel, H) => {
    const xf = panel * 3
    c.fillStyle = '#f7f7f7'
    c.fillRect(0, 0, panel * 4, H)
    // Pliegues suaves de la camiseta
    c.strokeStyle = '#c9ccd2'
    c.lineWidth = 3
    trazo(c, xf, panel, H, [[0.18, 0.62], [0.42, 0.72]])
    trazo(c, xf, panel, H, [[0.6, 0.7], [0.84, 0.6]])
    trazo(c, panel, panel, H, [[0.3, 0.6], [0.55, 0.66]])
    // Cintura del vaquero
    c.fillStyle = '#26386b'
    c.fillRect(0, 0.9 * H, panel * 4, 0.1 * H)
  })
}

function vaquerosRubius(): THREE.Texture {
  return textura(
    (c, _panel, H) => {
      c.fillStyle = '#2b3f78'
      c.fillRect(0, 0, H, H)
      c.fillStyle = 'rgba(255,255,255,0.05)'
      for (let y = 0; y < H; y += 6) c.fillRect(0, y, H, 2)
      c.strokeStyle = '#1a2850'
      c.lineWidth = 3
      c.beginPath()
      c.arc(0.1 * H, 0.05 * H, 0.35 * H, 0, Math.PI / 2)
      c.stroke()
    },
    256,
    256
  )
}

const texturas = new Map<string, THREE.Texture>()
function unaVez(clave: string, crear: () => THREE.Texture): THREE.Texture {
  let t = texturas.get(clave)
  if (!t) texturas.set(clave, (t = crear()))
  return t
}

const PRESETS: Record<string, () => Skin> = {
  jonesy: () => ({
    piel: '#f3cfa8',
    pelo: '#f4c430',
    peinado: 'barrido',
    cara: 'picara',
    torso: '#ffffff',
    torsoMapa: unaVez('jonesy', torsoJonesy),
    brazos: '#f3cfa8',
    manos: '#2f6b3a',
    cadera: '#e3cf9c',
    piernas: '#efdcb0',
    piernasMapa: unaVez('camuflaje', camuflajeJonesy),
    botas: '#2b2622',
    pies: '#2b2622'
  }),
  aura: () => ({
    piel: '#d99a6c',
    pelo: '#b4562a',
    peinado: 'trenzasGorra',
    gorra: '#f2a900',
    cara: 'alegre',
    torso: '#ffffff',
    torsoMapa: unaVez('aura', torsoAura),
    brazos: '#d99a6c',
    manos: '#1e1e1e',
    cadera: '#1e1f22',
    piernas: '#232428',
    detallePiernas: '#6c7078',
    pies: '#f2a900',
    tatuaje: '#2b2b2b'
  }),
  'palito de pescado': () => ({
    piel: '#4fa89a',
    pelo: '#4fa89a',
    peinado: 'pez',
    gorra: '#f2c230',
    cara: 'pez',
    torso: '#ffffff',
    torsoMapa: unaVez('palito', torsoPalito),
    brazos: '#f2c230',
    manos: '#4fa89a',
    cadera: '#1f3a5f',
    piernas: '#24426b',
    botas: '#2e5a3a',
    pies: '#2e5a3a'
  }),
  novata: () => ({
    piel: '#e8b58e',
    pelo: '#2b1d14',
    peinado: 'mono',
    cara: 'gafas',
    gafas: '#2f6fd6',
    torso: '#ffffff',
    torsoMapa: unaVez('novata', torsoNovata),
    brazos: '#f4f4f4',
    manos: '#e8b58e',
    cadera: '#1f2a44',
    piernas: '#25314f',
    pies: '#f5f5f5'
  }),
  neblina: () => ({
    piel: '#f3d2bf',
    pelo: '#ff6fb5',
    peinado: 'melena',
    cara: 'delineado',
    collar: '#1a1a1a',
    torso: '#ffffff',
    torsoMapa: unaVez('neblina', torsoNeblina),
    brazos: '#6c4ab6',
    manos: '#f3d2bf',
    cadera: '#6f747d',
    piernas: '#8a8f98',
    detallePiernas: '#f3d2bf',
    pies: '#f5f5f5'
  }),
  midas: () => ({
    piel: '#f1d0b0',
    pelo: '#141414',
    peinado: 'engominado',
    cara: 'cicatriz',
    torso: '#ffffff',
    torsoMapa: unaVez('midas', torsoMidas),
    brazos: '#f1d0b0',
    manga: '#f7f7f7',
    manos: '#e0a82e',
    manosMetal: true,
    cadera: '#1c1d20',
    piernas: '#1c1d20',
    detallePiernas: '#8e9196',
    tatuaje: '#1a1a1a'
  }),
  blue: () => ({
    piel: '#c9b48e',
    pelo: '#f5f5f5',
    peinado: 'capucha',
    gorra: '#f5f5f5',
    cara: 'perro',
    gafas: '#9aa0a6',
    torso: '#ffffff',
    torsoMapa: unaVez('blue', torsoBlue),
    brazos: '#f5f5f5',
    manos: '#c9b48e',
    cadera: '#1f2023',
    piernas: '#1f2023',
    piernasMapa: unaVez('cargo', cargoBlue)
  }),
  cluster: () => ({
    piel: '#ffd23f',
    pelo: '#ffd23f',
    peinado: 'pato',
    cabeza: 'esfera',
    cara: 'pato',
    gafas: '#111111',
    torso: '#ffffff',
    torsoMapa: unaVez('cluster', torsoCluster),
    brazos: '#ffd23f',
    manga: '#1fb5a8',
    manos: '#ffd23f',
    cadera: '#1d1d1d',
    piernas: '#f5f5f5',
    botas: '#1fb5a8',
    pies: '#1fb5a8'
  }),
  mariano: () => ({
    piel: '#45c3e0',
    pelo: '#45c3e0',
    peinado: 'alien',
    cabeza: 'alien',
    cara: 'alien',
    torso: '#ffffff',
    torsoMapa: unaVez('mariano', torsoMariano),
    brazos: '#45c3e0',
    manos: '#45c3e0',
    cadera: '#ffd93b',
    piernas: '#ffd93b',
    piernasMapa: unaVez('platanos', platanos),
    botas: '#45c3e0',
    pies: '#7a4a26'
  }),
  deriva: () => ({
    piel: '#f1d0b0',
    pelo: '#c0207f',
    peinado: 'capucha',
    gorra: '#c0207f',
    cara: 'mascara',
    torso: '#ffffff',
    torsoMapa: unaVez('deriva', torsoDeriva),
    brazos: '#1c1c1f',
    manos: '#1c1c1f',
    cadera: '#1c1c1f',
    piernas: '#1c1c1f',
    piernasMapa: unaVez('pantalonDeriva', pantalonDeriva),
    pies: '#f2f2f2'
  }),
  rubius: () => ({
    piel: '#f3d2b4',
    pelo: '#6b3f22',
    peinado: 'despeinado',
    cara: 'picara',
    bufanda: '#22335f',
    torso: '#ffffff',
    torsoMapa: unaVez('rubius', torsoRubius),
    brazos: '#f3d2b4',
    manga: '#f7f7f7',
    manos: '#f3d2b4',
    cadera: '#26386b',
    piernas: '#2b3f78',
    piernasMapa: unaVez('vaqueros', vaquerosRubius),
    pies: '#f5f5f5'
  })
}

// Otros nombres que llevan a la misma skin
const ALIAS: Record<string, string> = {
  'palito de pezcado': 'palito de pescado',
  palito: 'palito de pescado'
}

export const SKINS_DISPONIBLES = Object.keys(PRESETS)

// Skin de un agente: la del campo "Skin 3D" si existe; si no, la de su nombre; si no, la clásica.
export function skinDe(agente: Agente, pelo: string, piernas: string): Skin {
  const pedida = (agente.skin_modelo ?? '').trim().toLowerCase() || agente.nombre.trim().toLowerCase()
  const preset = PRESETS[ALIAS[pedida] ?? pedida]
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
