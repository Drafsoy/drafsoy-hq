import type { Agente } from '@/datos/tipos'

// Medidas del mundo (en "metros" del juego).
export const RADIO_ISLA = 46

// ---------- La agencia: oficinas privadas alrededor de un coworking (planta sin techo) ----------
export const ANCHO_OFICINA = 34 // x de -17 a 17
export const FONDO_OFICINA = 22 // z de -11 a 11 (coordenadas de la oficina)
export const Z_OFICINA = -5 // centro de la oficina en el mundo
export const ALTO_PARED = 3.4 // muros exteriores
export const ALTO_TABIQUE = 2.6 // paredes y cristaleras interiores
export const GROSOR_SUELO = 0.3
export const ANCHO_PUERTA = 1.6

type P = [number, number]

// La zona común ocupa la franja central; las oficinas abren a ella por una puerta de cristal
export const Z_CRISTAL_ATRAS = -4.5
export const Z_CRISTAL_DELANTE = 4.5
const CORREDOR_ATRAS = -3.6
const CORREDOR_DELANTE = 3.6
const PASILLOS_X = [-6, 12.3] // para cruzar el coworking de un lado a otro

export type TipoSala = 'oficina' | 'comun' | 'recepcion' | 'despacho'

export interface Sala {
  id: string
  tipo: TipoSala
  nombre: string
  icono: string
  color: string
  x: [number, number]
  z: [number, number]
  puerta: P // en la cristalera
  ancla: P // justo dentro de la puerta
  puestos: P[] // sillas (miran a +z, la mesa delante)
}

const oficinaAtras = (n: number, x0: number): Sala => {
  const cx = x0 + 4.25
  return { id: `oficina${n}`, tipo: 'oficina', nombre: 'Oficina', icono: '💼', color: '#868e96', x: [x0, x0 + 8.5], z: [-11, -4.5], puerta: [cx, -4.5], ancla: [cx, -5.5], puestos: [[cx, -8.7]] }
}
const oficinaDelante = (n: number, x0: number): Sala => {
  const cx = x0 + 4.25
  return { id: `oficina${n}`, tipo: 'oficina', nombre: 'Oficina', icono: '💼', color: '#868e96', x: [x0, x0 + 8.5], z: [4.5, 11], puerta: [cx, 4.5], ancla: [cx, 5.5], puestos: [[cx, 7.7]] }
}

export const SALAS: Sala[] = [
  oficinaAtras(1, -17),
  oficinaAtras(2, -8.5),
  oficinaAtras(3, 0),
  oficinaAtras(4, 8.5),
  oficinaDelante(5, 0),
  oficinaDelante(6, 8.5),
  { id: 'recepcion', tipo: 'recepcion', nombre: 'Recepción', icono: '🛎️', color: '#f59f00', x: [-17, -8.5], z: [4.5, 11], puerta: [-12.75, 4.5], ancla: [-12.75, 5.4], puestos: [] },
  { id: 'despacho', tipo: 'despacho', nombre: 'Despacho de Rafa', icono: '👑', color: '#1b1f4b', x: [-8.5, 0], z: [4.5, 11], puerta: [-4.25, 4.5], ancla: [-4.25, 5.5], puestos: [] },
  // Mesa compartida del coworking: para quien no tenga oficina
  { id: 'comun', tipo: 'comun', nombre: 'Coworking · Zona común', icono: '☕', color: '#e8590c', x: [-17, 17], z: [-4.5, 4.5], puerta: [5, CORREDOR_ATRAS], ancla: [5, CORREDOR_ATRAS], puestos: [[4.8, -0.9], [8.2, -0.9]] }
]

export const OFICINAS = SALAS.filter((s) => s.tipo === 'oficina')
export const sala = (id: string) => SALAS.find((s) => s.id === id)!
export const salaDe = (x: number, z: number): Sala =>
  SALAS.find((s) => s.tipo !== 'comun' && x >= s.x[0] && x <= s.x[1] && z >= s.z[0] && z <= s.z[1]) ?? sala('comun')

// Recepción y despacho
export const RECEPCION = { mostrador: [-12.75, 7.4] as P, puesto: [-12.75, 6.2] as P }
export const MESA_RAFA: P = [-4.25, 8.8]
// Tu silla: la ocupa tu agente supervisor (mira hacia la mesa, es decir, hacia -z)
export const SILLA_RAFA: P = [MESA_RAFA[0], MESA_RAFA[1] + 1.25]
export const GIRO_SILLA_RAFA = Math.PI
export const PUNTOS_DESPACHO: P[] = [SILLA_RAFA, [-6.6, 8.2], [-1.2, 6.2], [-4.25, 5.9]]
export const PUNTO_TE_NECESITA: P = [-4.25, 6.9] // delante de tu mesa
export const PUNTO_APROBACIONES: P = [-6.9, 7.3] // frente al tablero (mirando a la izquierda)
export const MURO_APROBACIONES = { x: -8.3, z: 7.3 }
export const GIRO_APROBACIONES = -Math.PI / 2

// ---------- Puestos: una oficina por empleado (por antigüedad); si no hay, mesa del coworking ----------
export const DIST_MESA = 0.95 // de la silla al centro de la mesa
const TODOS_PUESTOS: P[] = [...OFICINAS.flatMap((s) => s.puestos), ...sala('comun').puestos]
export const ES_PUESTO = (x: number, z: number) => [...TODOS_PUESTOS, SILLA_RAFA].some(([px, pz]) => Math.abs(px - x) < 0.05 && Math.abs(pz - z) < 0.05)
// Hueco por el que se llega a la silla (en tu despacho la mesa es más ancha)
const lateral = (x: number, z: number) => (Math.abs(x - SILLA_RAFA[0]) < 0.05 && Math.abs(z - SILLA_RAFA[1]) < 0.05 ? 2.1 : 1.5)

export function repartirPuestos(agentes: Agente[]): Map<string, P> {
  const mapa = new Map<string, P>()
  const empleados = agentes.filter((a) => !a.es_recepcionista && !a.es_supervisor).sort((a, b) => a.creado_en.localeCompare(b.creado_en))
  empleados.forEach((a, i) => mapa.set(a.id, TODOS_PUESTOS[i] ?? [-1 + (i - TODOS_PUESTOS.length) * 0.9, 2.2]))
  return mapa
}

// Dueño de cada oficina (id de sala → id de agente)
export function duenosDeOficinas(agentes: Agente[]): Map<string, string> {
  const puestos = repartirPuestos(agentes)
  const mapa = new Map<string, string>()
  for (const [agenteId, [x, z]] of puestos) {
    const s = salaDe(x, z)
    if (s.tipo === 'oficina') mapa.set(s.id, agenteId)
  }
  return mapa
}

// ---------- Rutas: oficina → puerta → pasillo del coworking → puerta → oficina ----------
const corredorDe = (s: Sala, p: P) => (s.tipo === 'comun' ? (p[1] < 0 ? CORREDOR_ATRAS : CORREDOR_DELANTE) : s.z[1] <= Z_CRISTAL_ATRAS + 0.01 ? CORREDOR_ATRAS : CORREDOR_DELANTE)

export function ruta(desde: P, hasta: P): P[] {
  const a = salaDe(...desde)
  const b = salaDe(...hasta)
  const puntos: P[] = []
  // Salir de la silla por el lado izquierdo de la mesa
  if (ES_PUESTO(...desde)) puntos.push([desde[0] - lateral(...desde), desde[1]], [desde[0] - lateral(...desde), a.ancla[1]])
  if (!(a.id === b.id && a.tipo !== 'comun')) {
    const ca = corredorDe(a, desde)
    const cb = corredorDe(b, hasta)
    if (a.tipo !== 'comun') puntos.push(a.ancla, a.puerta)
    const xa = a.tipo === 'comun' ? desde[0] : a.puerta[0]
    const xb = b.tipo === 'comun' ? hasta[0] : b.puerta[0]
    puntos.push([xa, ca])
    if (ca !== cb) {
      const medio = (xa + xb) / 2
      const px = PASILLOS_X.reduce((m, p) => (Math.abs(p - medio) < Math.abs(m - medio) ? p : m))
      puntos.push([px, ca], [px, cb])
    }
    puntos.push([xb, cb])
    if (b.tipo !== 'comun') puntos.push(b.puerta, b.ancla)
  }
  if (ES_PUESTO(...hasta)) puntos.push([hasta[0] - lateral(...hasta), b.ancla[1]], [hasta[0] - lateral(...hasta), hasta[1]])
  puntos.push(hasta)
  return puntos
}

// Sitios del coworking a los que van cuando están libres
export const PUNTOS_PASEO: P[] = [
  [-15.1, 0], // cafetera
  [-12.9, -2.1], // barra
  [-3.2, -0.6], // sala de estar
  [-1, 2.3], // sala de estar (delante)
  [13.4, 0], // ping-pong
  [16.3, 0], // ping-pong (otro lado)
  [9.8, 2.3], // mesa compartida
  [2.6, 2.4] // planta y ventana
]
export const PUNTOS_RECEPCION: P[] = [RECEPCION.puesto, [-15.8, 5.4], [-10, 5.6], [-10.2, 9.6]]

// ---------- Utilidades ----------

// El río cruza la isla delante del pueblo.
export const zRio = (x: number) => 20 + Math.sin(x / 9) * 4

// Generador aleatorio con semilla: los árboles siempre salen en el mismo sitio.
export function aleatorio(semilla: number) {
  let a = semilla
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Aclara un color hex mezclándolo con blanco.
export function aclarar(hex: string, cantidad: number) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const m = (c: number) => Math.round(c + (255 - c) * cantidad)
  return `#${((1 << 24) | (m(r) << 16) | (m(g) << 8) | m(b)).toString(16).slice(1)}`
}

// Puesto (silla) de un agente dentro de la oficina
export function puestoDe(agente: Agente, agentes: Agente[]): [number, number] {
  if (agente.es_recepcionista) return RECEPCION.puesto
  if (agente.es_supervisor) return SILLA_RAFA
  return repartirPuestos(agentes).get(agente.id) ?? [-1, 2.2]
}

// Convierte coordenadas de la oficina a coordenadas del mundo
export const enMundo = (x: number, z: number, y = 0): [number, number, number] => [x, y + GROSOR_SUELO, z + Z_OFICINA]