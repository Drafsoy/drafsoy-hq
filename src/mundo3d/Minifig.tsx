import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Agente } from '@/datos/tipos'
import { ESTADOS_AGENTE } from '@/datos/tipos'
import { skinDe } from './skins'
import { posicionesAgentes } from './seguimiento'
import { GIRO_APROBACIONES, GIRO_SILLA_RAFA, PUNTOS_DESPACHO, PUNTOS_PASEO, PUNTOS_RECEPCION, PUNTO_APROBACIONES, PUNTO_TE_NECESITA, ruta } from './medidas'

const EMOJI_ESTADO = { disponible: '✅', trabajando: '⌨️', te_necesita: '❗', esperando_aprobacion: '⏳' } as const
const PELOS = ['#3b2414', '#111111', '#e0a43a', '#c0462b', '#6b4a2f']
const PIERNAS = ['#26315c', '#3a3a3a', '#1f4f8a', '#4a2b6b']
const VELOCIDAD = 2
const ALTO_CADERA = 0.72

type Modo = 'pasear' | 'sentado' | 'escritorio' | 'aprobaciones' | 'frente'

interface Props {
  agente: Agente
  asiento: [number, number] // dónde está su silla (coordenadas de la oficina)
  conSilla: boolean
  bailando: boolean
  alClic: () => void
}

// Minifigura estilo LEGO que vive en la oficina: trabaja en su mesa, pasea y te hace señas.
export default function Minifig({ agente, asiento, conSilla, bailando, alClic }: Props) {
  const raiz = useRef<THREE.Group>(null)
  const cuerpo = useRef<THREE.Group>(null)
  const piernaIzq = useRef<THREE.Group>(null)
  const piernaDer = useRef<THREE.Group>(null)
  const brazoIzq = useRef<THREE.Group>(null)
  const brazoDer = useRef<THREE.Group>(null)
  const cabeza = useRef<THREE.Group>(null)
  const globo = useRef<HTMLDivElement>(null)
  const [encima, setEncima] = useState(false)

  // Estado del movimiento (no provoca re-render)
  const pos = useRef(new THREE.Vector2(asiento[0], asiento[1]))
  const camino = useRef<THREE.Vector2[]>([])
  const espera = useRef(Math.random() * 3)
  const modoActual = useRef<Modo | null>(null)
  const sentadoLibre = useRef(false) // libre pero sentado en su mesa un rato
  const giro = useRef(0)
  const posMundo = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => () => void posicionesAgentes.delete(agente.id), [agente.id])

  const variante = useMemo(() => {
    let h = 0
    for (const c of agente.id) h = (h * 31 + c.charCodeAt(0)) >>> 0
    return {
      pelo: PELOS[h % PELOS.length],
      piernas: PIERNAS[(h >> 3) % PIERNAS.length],
      fase: (h % 100) / 10,
      hueco: ((h >> 5) % 5) - 2 // para no amontonarse en el mismo sitio
    }
  }, [agente.id])

  const irA = (destino: [number, number]) => {
    camino.current = ruta([pos.current.x, pos.current.y], destino).map(([x, z]) => new THREE.Vector2(x, z))
  }

  useFrame(({ clock, camera }, dt) => {
    const r = raiz.current
    const c = cuerpo.current
    const pi = piernaIzq.current
    const pd = piernaDer.current
    const bi = brazoIzq.current
    const bd = brazoDer.current
    const ca = cabeza.current
    if (!r || !c || !pi || !pd || !bi || !bd || !ca) return
    const t = clock.elapsedTime + variante.fase
    dt = Math.min(dt, 0.1)

    // Globo visible solo de cerca
    if (globo.current) {
      r.getWorldPosition(posMundo)
      posicionesAgentes.set(agente.id, posMundo)
      const distancia = camera.position.distanceTo(posMundo)
      globo.current.style.opacity = distancia < 60 ? '1' : '0'
      // De cerca no crece sin límite: se encoge para no tapar al personaje
      globo.current.style.transform = `scale(${Math.min(1, distancia / 20).toFixed(2)})`
      globo.current.style.transformOrigin = 'bottom center'
    }

    // ¿Qué debería estar haciendo según su estado?
    const modo: Modo =
      agente.estado === 'trabajando'
        ? conSilla
          ? 'sentado'
          : 'escritorio'
        : agente.estado === 'te_necesita'
          ? 'frente'
          : agente.estado === 'esperando_aprobacion'
            ? 'aprobaciones'
            : 'pasear'

    if (modo !== modoActual.current) {
      modoActual.current = modo
      sentadoLibre.current = false
      if (modo === 'frente') irA([PUNTO_TE_NECESITA[0] + variante.hueco * 0.9, PUNTO_TE_NECESITA[1]])
      else if (modo === 'aprobaciones') irA([PUNTO_APROBACIONES[0] + Math.abs(variante.hueco) * 0.5, PUNTO_APROBACIONES[1] + variante.hueco * 0.7])
      else if (modo !== 'pasear') irA(asiento)
      else espera.current = 0.5 + Math.random() * 2
    }
    // Pose base
    c.position.set(0, 0, 0)
    c.rotation.set(0, 0, 0)
    pi.rotation.set(0, 0, 0)
    pd.rotation.set(0, 0, 0)
    bi.rotation.set(0, 0, 0)
    bd.rotation.set(0, 0, 0)
    ca.rotation.set(0, Math.sin(t * 0.7) * 0.25, 0)

    // Emote de celebración: baila donde esté
    if (bailando) {
      c.rotation.y = t * 6
      c.position.y = Math.abs(Math.sin(t * 8)) * 0.5
      bi.rotation.x = -2.6 + Math.sin(t * 12) * 0.4
      bd.rotation.x = -2.6 - Math.sin(t * 12) * 0.4
      pi.rotation.x = Math.sin(t * 8) * 0.4
      pd.rotation.x = -Math.sin(t * 8) * 0.4
      r.position.set(pos.current.x, 0, pos.current.y)
      return
    }

    let caminando = camino.current.length > 0
    const sentadoEnSilla = modo === 'sentado' || (modo === 'pasear' && sentadoLibre.current)
    let giroDeseado = modo === 'aprobaciones' ? GIRO_APROBACIONES : agente.es_supervisor && sentadoEnSilla ? GIRO_SILLA_RAFA : 0 // mirar a la cámara (o al muro)

    if (caminando) {
      const objetivo = camino.current[0]
      const dx = objetivo.x - pos.current.x
      const dz = objetivo.y - pos.current.y
      const dist = Math.hypot(dx, dz)
      const paso = VELOCIDAD * dt
      if (dist <= paso) {
        pos.current.copy(objetivo)
        camino.current.shift()
      } else {
        pos.current.x += (dx / dist) * paso
        pos.current.y += (dz / dist) * paso
      }
      giroDeseado = Math.atan2(dx, dz)
      caminando = camino.current.length > 0 || dist > paso
    } else if (modo === 'pasear') {
      espera.current -= dt
      if (espera.current <= 0) {
        const libres = agente.es_recepcionista ? PUNTOS_RECEPCION : agente.es_supervisor ? PUNTOS_DESPACHO : PUNTOS_PASEO
        // A veces vuelve a su mesa a revisar cosas sentado
        sentadoLibre.current = !agente.es_recepcionista && Math.random() < 0.3
        const [x, z] = sentadoLibre.current ? asiento : libres[Math.floor(Math.random() * libres.length)]
        irA(sentadoLibre.current ? [x, z] : [x + (Math.random() - 0.5) * 0.8, z + (Math.random() - 0.5) * 0.4])
        espera.current = 4 + Math.random() * 6
      }
      giroDeseado = Math.sin(t * 0.3) * 0.6
    }

    // Girar suavemente hacia donde va
    let diferencia = giroDeseado - giro.current
    diferencia = Math.atan2(Math.sin(diferencia), Math.cos(diferencia))
    giro.current += diferencia * (1 - Math.exp(-10 * dt))
    r.rotation.y = giro.current
    r.position.set(pos.current.x, 0, pos.current.y)

    if (caminando) {
      const paso = Math.sin(t * 10)
      pi.rotation.x = paso * 0.6
      pd.rotation.x = -paso * 0.6
      bi.rotation.x = -paso * 0.5
      bd.rotation.x = paso * 0.5
      c.position.y = Math.abs(Math.cos(t * 10)) * 0.06
      return
    }

    const sentarse = modo === 'sentado' || (modo === 'pasear' && sentadoLibre.current)
    switch (sentarse ? 'sentado' : modo) {
      case 'sentado':
        // Sentado en la silla tecleando
        c.position.y = -0.08
        pi.rotation.x = -Math.PI / 2
        pd.rotation.x = -Math.PI / 2
        if (modo === 'sentado') {
          // Tecleando a toda velocidad
          bi.rotation.x = -1.1 + Math.sin(t * 18) * 0.12
          bd.rotation.x = -1.1 - Math.sin(t * 18) * 0.12
          ca.rotation.x = 0.12
        } else {
          // Revisando con calma (una mano en el ratón)
          bd.rotation.x = -1.1 + Math.sin(t * 2) * 0.05
          ca.rotation.y = Math.sin(t * 0.8) * 0.3
        }
        break
      case 'escritorio':
        bi.rotation.x = -1.1 + Math.sin(t * 18) * 0.12
        bd.rotation.x = -1.1 - Math.sin(t * 18) * 0.12
        break
      case 'aprobaciones':
        // Frente al muro: mira el reloj y golpea el suelo con el pie
        bd.rotation.x = -1.4
        bd.rotation.z = -0.5
        ca.rotation.x = -0.2
        pd.rotation.x = Math.max(0, Math.sin(t * 6)) * -0.3
        break
      case 'frente':
        // Te necesita: salta y agita el brazo
        c.position.y = Math.abs(Math.sin(t * 5)) * 0.45
        bd.rotation.x = -2.8
        bd.rotation.z = Math.sin(t * 10) * 0.35
        bi.rotation.x = -2.8
        bi.rotation.z = -Math.sin(t * 10) * 0.35
        break
      default:
        c.position.y = Math.sin(t * 2) * 0.02
        bi.rotation.x = Math.sin(t * 1.5) * 0.08
        bd.rotation.x = -Math.sin(t * 1.5) * 0.08
    }
  })

  const estado = ESTADOS_AGENTE[agente.estado]
  const skin = useMemo(() => skinDe(agente, variante.pelo, variante.piernas), [agente, variante])
  const plastico = (color: string) => <meshStandardMaterial color={color} roughness={0.3} />

  return (
    <group
      ref={raiz}
      position={[asiento[0], 0, asiento[1]]}
      scale={encima ? 1.12 : 1}
      onClick={(e) => {
        e.stopPropagation()
        alClic()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setEncima(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setEncima(false)
        document.body.style.cursor = ''
      }}
    >
      <group ref={cuerpo}>
        {/* Piernas (giran desde la cadera) */}
        {[
          { ref: piernaIzq, x: -0.2 },
          { ref: piernaDer, x: 0.2 }
        ].map(({ ref, x }) => (
          <group key={x} ref={ref} position={[x, ALTO_CADERA, 0]}>
            <mesh position={[0, -0.36, 0]} castShadow>
              <boxGeometry args={[0.38, 0.72, 0.46]} />
              {plastico(skin.piernas)}
            </mesh>
            {/* Pie */}
            <mesh position={[0, -0.66, 0.08]}>
              <boxGeometry args={[0.38, 0.12, 0.6]} />
              {plastico(skin.pies ?? skin.piernas)}
            </mesh>
            {skin.detallePiernas &&
              (skin.pies ? [-0.28, -0.36, -0.44] : x < 0 ? [-0.3] : []).map((y, i) => (
                // Rotos del pantalón (o un bolsillo con cremallera)
                <mesh key={y} position={[(i % 2 ? 0.03 : -0.03) * (x < 0 ? 1 : -1), y, 0.232]} rotation-z={0.15 * (i - 1)}>
                  <boxGeometry args={[0.2 - i * 0.03, 0.03, 0.01]} />
                  <meshStandardMaterial color={skin.detallePiernas} />
                </mesh>
              ))}
          </group>
        ))}
        <mesh position={[0, 0.78, 0]} castShadow>
          <boxGeometry args={[0.8, 0.14, 0.46]} />
          {plastico(skin.cadera)}
        </mesh>

        {/* Torso trapezoidal (con estampado si la skin lo tiene) */}
        <group position={[0, 1.2, 0]} scale={[1, 1, 0.58]}>
          <mesh rotation-y={Math.PI / 4} castShadow>
            <cylinderGeometry args={[0.36, 0.56, 0.72, 4]} />
            <meshStandardMaterial color={skin.torso} map={skin.torsoMapa ?? null} roughness={0.3} />
          </mesh>
        </group>
        {!skin.torsoMapa && (
          <mesh position={[0, 1.22, 0.215]} rotation-x={-0.25}>
            <circleGeometry args={[0.11, 16]} />
            <meshStandardMaterial color="white" />
          </mesh>
        )}

        {/* Brazos (giran desde el hombro); con manga corta el antebrazo es de piel */}
        {[
          { ref: brazoIzq, x: -0.44 },
          { ref: brazoDer, x: 0.44 }
        ].map(({ ref, x }) => (
          <group key={x} ref={ref} position={[x, 1.48, 0]}>
            <group position={[x > 0 ? 0.06 : -0.06, -0.26, 0]} rotation-z={x > 0 ? 0.18 : -0.18}>
              {skin.manga ? (
                <>
                  <mesh position-y={0.15} castShadow>
                    <cylinderGeometry args={[0.125, 0.128, 0.26, 10]} />
                    {plastico(skin.manga)}
                  </mesh>
                  <mesh position-y={-0.13} castShadow>
                    <cylinderGeometry args={[0.118, 0.125, 0.3, 10]} />
                    {plastico(skin.brazos)}
                  </mesh>
                </>
              ) : (
                <mesh castShadow>
                  <cylinderGeometry args={[0.12, 0.13, 0.56, 10]} />
                  {plastico(skin.brazos)}
                </mesh>
              )}
              {/* Tatuaje en el brazo derecho */}
              {skin.tatuaje && x > 0 && (
                <group>
                  <mesh position-y={0.05}>
                    <cylinderGeometry args={[0.131, 0.131, 0.06, 12, 1, true]} />
                    <meshStandardMaterial color={skin.tatuaje} />
                  </mesh>
                  <mesh position-y={-0.12}>
                    <cylinderGeometry args={[0.129, 0.129, 0.04, 12, 1, true]} />
                    <meshStandardMaterial color="#e3b23c" />
                  </mesh>
                </group>
              )}
            </group>
            <mesh position={[x > 0 ? 0.1 : -0.1, -0.6, 0.04]} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.09, 0.045, 8, 14, Math.PI * 1.5]} />
              {plastico(skin.manos)}
            </mesh>
          </group>
        ))}

        {/* Cabeza */}
        <group ref={cabeza} position={[0, 1.6, 0]}>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.1, 12]} />
            {plastico(skin.piel)}
          </mesh>
          <mesh position={[0, 0.32, 0]} castShadow>
            <cylinderGeometry args={[0.26, 0.26, 0.44, 24]} />
            {plastico(skin.piel)}
          </mesh>
          {/* Ojos */}
          {[-0.09, 0.09].map((x) => (
            <mesh key={x} position={[x, 0.36, 0.25]}>
              <sphereGeometry args={[0.032, 8, 8]} />
              <meshBasicMaterial color="#1a1a1a" />
            </mesh>
          ))}
          {skin.cara === 'picara' ? (
            <>
              {/* Cejas (una levantada) y sonrisa ladeada */}
              <mesh position={[-0.09, 0.43, 0.253]} rotation-z={0.15}>
                <boxGeometry args={[0.09, 0.018, 0.01]} />
                <meshBasicMaterial color="#5a3b1c" />
              </mesh>
              <mesh position={[0.09, 0.445, 0.253]} rotation-z={-0.3}>
                <boxGeometry args={[0.09, 0.018, 0.01]} />
                <meshBasicMaterial color="#5a3b1c" />
              </mesh>
              <mesh position={[0.035, 0.265, 0.25]} rotation-z={Math.PI + 0.35}>
                <torusGeometry args={[0.075, 0.014, 6, 16, Math.PI * 0.8]} />
                <meshBasicMaterial color="#1a1a1a" />
              </mesh>
            </>
          ) : skin.cara === 'alegre' ? (
            <>
              {/* Sombra de ojos morada, pestañas, marcas en las mejillas y gran sonrisa con labios rojos */}
              {[-0.09, 0.09].map((x) => (
                <group key={x}>
                  <mesh position={[x, 0.405, 0.252]}>
                    <boxGeometry args={[0.08, 0.025, 0.01]} />
                    <meshBasicMaterial color="#9c6ade" />
                  </mesh>
                  <mesh position={[x + (x > 0 ? 0.04 : -0.04), 0.375, 0.253]} rotation-z={x > 0 ? -0.6 : 0.6}>
                    <boxGeometry args={[0.035, 0.012, 0.01]} />
                    <meshBasicMaterial color="#1a1a1a" />
                  </mesh>
                  <mesh position={[x * 1.2, 0.3, 0.252]} rotation-z={x > 0 ? 0.3 : -0.3}>
                    <boxGeometry args={[0.012, 0.05, 0.01]} />
                    <meshBasicMaterial color="#3b2a20" />
                  </mesh>
                </group>
              ))}
              <mesh position={[0, 0.455, 0.252]}>
                <sphereGeometry args={[0.012, 6, 6]} />
                <meshBasicMaterial color="#3b2a20" />
              </mesh>
              <mesh position={[0, 0.265, 0.252]} rotation-z={Math.PI}>
                <torusGeometry args={[0.085, 0.024, 6, 18, Math.PI]} />
                <meshBasicMaterial color="#c92a2a" />
              </mesh>
              <mesh position={[0, 0.255, 0.255]} rotation-z={Math.PI}>
                <circleGeometry args={[0.06, 16, 0, Math.PI]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </>
          ) : (
            <mesh position={[0, 0.27, 0.25]} rotation-z={Math.PI}>
              <torusGeometry args={[0.09, 0.016, 6, 16, Math.PI]} />
              <meshBasicMaterial color="#1a1a1a" />
            </mesh>
          )}

          {/* Pelo */}
          {skin.peinado === 'trenzasGorra' ? (
            <group position-y={0.5}>
              {/* Pelo bajo la gorra: laterales y nuca */}
              <mesh position={[0, -0.08, -0.04]}>
                <cylinderGeometry args={[0.29, 0.3, 0.32, 24, 1, false, Math.PI * 0.42, Math.PI * 1.16]} />
                {plastico(skin.pelo)}
              </mesh>
              {/* Flequillo a los lados de la frente */}
              {[-0.17, 0.17].map((x) => (
                <mesh key={x} position={[x, 0.0, 0.17]} rotation-z={x > 0 ? -0.5 : 0.5} scale={[0.8, 1.3, 0.6]}>
                  <sphereGeometry args={[0.1, 12, 10]} />
                  {plastico(skin.pelo)}
                </mesh>
              ))}
              {/* Gorra del revés */}
              <mesh position={[0, 0.08, -0.01]} scale={[1, 0.7, 1]} castShadow>
                <sphereGeometry args={[0.305, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                {plastico(skin.gorra ?? '#f2a900')}
              </mesh>
              <mesh position={[0, 0.08, -0.01]} rotation-x={-Math.PI / 2}>
                <ringGeometry args={[0.27, 0.31, 24]} />
                {plastico(skin.gorra ?? '#f2a900')}
              </mesh>
              {/* Visera hacia atrás */}
              <mesh position={[0, 0.07, -0.38]} rotation-x={0.12} castShadow>
                <boxGeometry args={[0.36, 0.035, 0.26]} />
                {plastico(skin.gorra ?? '#f2a900')}
              </mesh>
              {/* Botón de la gorra y abertura trasera con el pelo asomando */}
              <mesh position={[0, 0.3, 0]}>
                <sphereGeometry args={[0.04, 10, 8]} />
                {plastico(skin.gorra ?? '#f2a900')}
              </mesh>
              <mesh position={[0, 0.12, -0.26]} scale={[1.2, 0.8, 0.6]}>
                <sphereGeometry args={[0.09, 12, 10]} />
                {plastico(skin.pelo)}
              </mesh>
              {/* Dos trenzas largas cayendo por delante de los hombros */}
              {[-1, 1].map((lado) => (
                <group key={lado}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <mesh
                      key={i}
                      position={[lado * (0.26 + i * 0.012), -0.2 - i * 0.12, 0.06 + i * 0.03]}
                      scale={[1, 1.25, 1]}
                      castShadow
                    >
                      <sphereGeometry args={[0.085 - i * 0.006, 12, 10]} />
                      {plastico(i % 2 ? new THREE.Color(skin.pelo).multiplyScalar(0.85).getStyle() : skin.pelo)}
                    </mesh>
                  ))}
                  <mesh position={[lado * 0.33, -0.88, 0.25]}>
                    <cylinderGeometry args={[0.04, 0.05, 0.08, 10]} />
                    {plastico(new THREE.Color(skin.pelo).multiplyScalar(0.7).getStyle())}
                  </mesh>
                </group>
              ))}
            </group>
          ) : skin.peinado === 'barrido' ? (
            <group position-y={0.5}>
              {/* Casquete */}
              <mesh position={[0, 0.06, -0.02]} scale={[1, 0.62, 1]} castShadow>
                <sphereGeometry args={[0.31, 22, 16]} />
                {plastico(skin.pelo)}
              </mesh>
              {/* Tupé peinado hacia un lado */}
              <mesh position={[-0.05, 0.13, 0.12]} rotation={[0.5, 0, 0.25]} scale={[1.25, 0.55, 0.9]} castShadow>
                <sphereGeometry args={[0.2, 18, 12]} />
                {plastico(skin.pelo)}
              </mesh>
              {/* Nuca y patillas */}
              <mesh position={[0, -0.1, -0.12]}>
                <cylinderGeometry args={[0.285, 0.285, 0.28, 22, 1, false, Math.PI * 0.55, Math.PI * 0.9]} />
                {plastico(skin.pelo)}
              </mesh>
              {/* Mechones (relieve) */}
              {[-0.16, -0.06, 0.04, 0.14].map((mx) => (
                <mesh key={mx} position={[mx, 0.2, -0.02]} rotation-z={0.25}>
                  <boxGeometry args={[0.03, 0.04, 0.5]} />
                  {plastico(new THREE.Color(skin.pelo).multiplyScalar(0.88).getStyle())}
                </mesh>
              ))}
            </group>
          ) : (
            <>
              <mesh position={[0, 0.58, -0.03]} castShadow>
                <cylinderGeometry args={[0.29, 0.3, 0.2, 20]} />
                {plastico(skin.pelo)}
              </mesh>
              <mesh position={[0, 0.42, -0.14]}>
                <boxGeometry args={[0.58, 0.36, 0.24]} />
                {plastico(skin.pelo)}
              </mesh>
            </>
          )}
          {agente.es_recepcionista && skin.peinado === 'basico' && (
            <mesh position={[0, 0.74, 0]}>
              <cylinderGeometry args={[0.22, 0.32, 0.12, 20]} />
              {plastico('#ff5a6e')}
            </mesh>
          )}
        </group>
      </group>
      {/* Globo de estado (se oculta cuando la cámara está lejos) */}
      <Html position={[0, 2.8, 0]} center distanceFactor={22} zIndexRange={[30, 0]}>
        <div ref={globo} className="pointer-events-none flex flex-col items-center gap-0.5 transition-opacity duration-300 select-none">
          <div
            className={`rounded-full border-[3px] border-black/40 px-3 py-1 text-[17px] font-black whitespace-nowrap text-noche shadow-lg ${
              agente.estado === 'te_necesita' ? 'animate-bounce' : ''
            }`}
            style={{ background: estado.color }}
          >
            {EMOJI_ESTADO[agente.estado]} {estado.texto}
          </div>
          <div className="titulo-juego text-[22px] whitespace-nowrap text-white">{agente.nombre}</div>
        </div>
      </Html>
    </group>
  )
}
