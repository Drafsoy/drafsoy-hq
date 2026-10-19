import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { RADIO_ISLA, aleatorio, zRio } from './medidas'
import { CASAS, NIVEL_AGUA, alturaTerreno, esArena, libre, radioCosta } from './terreno'
import { ArbolOtono } from './Detalles'
import { textura } from './texturas'

// Paleta cartoon saturada
const PASTO = ['#74bd38', '#82c742', '#90d04c', '#68b031']
const ARENA = '#f6d58a'
const ARENA_MOJADA = '#e2bb6c'
const AGUA = '#25b4f5'

export default function Isla() {
  return (
    <group>
      <Mar />
      <Terreno />
      <Puente />
      <Arboles />
      <Arbustos />
      <Flores />
      <Rocas />
      <Acantilados />
      {CASAS.map(([x, z], i) => (
        <Casa key={i} x={x} z={z} color={['#ff6b6b', '#4dabf7', '#ffa94d', '#b197fc'][i % 4]} />
      ))}
      <Muelle />
      <IslasLejanas />
      <Nubes />
    </group>
  )
}

// ---------- Terreno con colinas, playa y río ----------

function Terreno() {
  const geometria = useMemo(() => {
    const tam = (RADIO_ISLA + 14) * 2
    const geo = new THREE.PlaneGeometry(tam, tam, 220, 220)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const colores = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    const tonos = PASTO.map((p) => new THREE.Color(p))

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const h = alturaTerreno(x, z)
      pos.setY(i, h)

      if (h < NIVEL_AGUA + 0.25) c.set(ARENA_MOJADA)
      else if (esArena(x, z)) c.set(ARENA)
      else {
        // Manchas de distintos verdes, como el pasto del juego
        const n = (Math.sin(x * 0.21) + Math.cos(z * 0.17) + Math.sin((x + z) * 0.07) * 1.5 + 3) / 6
        const k = Math.min(Math.max(Math.floor(n * tonos.length), 0), tonos.length - 1)
        c.copy(tonos[k])
        if (h > 4) c.lerp(new THREE.Color('#9be36a'), Math.min((h - 4) / 6, 0.6))
      }
      colores.set([c.r, c.g, c.b], i * 3)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colores, 3))
    geo.computeVertexNormals()
    return geo
  }, [])

  return (
    <mesh geometry={geometria} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
  )
}

function Mar() {
  const espuma = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!espuma.current) return
    const s = 1 + Math.sin(clock.elapsedTime * 0.9) * 0.012
    espuma.current.scale.set(s, s, 1)
    ;(espuma.current.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(clock.elapsedTime * 0.9) * 0.15
  })
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={NIVEL_AGUA} receiveShadow>
        <circleGeometry args={[600, 64]} />
        <meshStandardMaterial color={AGUA} roughness={0.15} metalness={0.05} transparent opacity={0.92} />
      </mesh>
      <mesh ref={espuma} rotation-x={-Math.PI / 2} position-y={NIVEL_AGUA + 0.05}>
        <ringGeometry args={[RADIO_ISLA - 1, RADIO_ISLA + 3.5, 96]} />
        <meshBasicMaterial color="white" transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

function Puente() {
  const z = zRio(0)
  return (
    <group position={[0, 0.25, z]}>
      <RoundedBox args={[4.2, 0.45, 10]} radius={0.12} castShadow receiveShadow>
        <meshStandardMaterial color="#b0703a" />
      </RoundedBox>
      {[-2, 2].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.75, 0]} castShadow>
            <boxGeometry args={[0.25, 0.25, 10]} />
            <meshStandardMaterial color="#8a5226" />
          </mesh>
          {[-4.5, -1.5, 1.5, 4.5].map((pz) => (
            <mesh key={pz} position={[x, 0.45, pz]} castShadow>
              <boxGeometry args={[0.3, 0.8, 0.3]} />
              <meshStandardMaterial color="#8a5226" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ---------- Vegetación ----------

function usarPuntos(semilla: number, cantidad: number, margen: number, separacion: number) {
  return useMemo(() => {
    const azar = aleatorio(semilla)
    const lista: { x: number; z: number; y: number; s: number; v: number }[] = []
    let intentos = 0
    while (lista.length < cantidad && intentos < 5000) {
      intentos++
      const ang = azar() * Math.PI * 2
      const r = 6 + Math.sqrt(azar()) * (RADIO_ISLA - 6)
      const x = Math.cos(ang) * r
      const z = Math.sin(ang) * r
      if (!libre(x, z, margen)) continue
      if (lista.some((a) => (a.x - x) ** 2 + (a.z - z) ** 2 < separacion ** 2)) continue
      lista.push({ x, z, y: alturaTerreno(x, z), s: 0.8 + azar() * 0.6, v: azar() })
    }
    return lista
  }, [semilla, cantidad, margen, separacion])
}

function Arboles() {
  const arboles = usarPuntos(7, 48, 1, 4.2)
  return (
    <group>
      {arboles.map((a, i) =>
        a.v < 0.12 ? (
          <ArbolOtono key={i} position={[a.x, a.y - 0.2, a.z]} escala={a.s * 1.5} />
        ) : a.v > 0.5 ? (
          <ArbolFrondoso key={i} {...a} />
        ) : (
          <Pino key={i} {...a} />
        )
      )}
    </group>
  )
}

// Árbol redondo y esponjoso, como los del juego
function ArbolFrondoso({ x, y, z, s, v }: { x: number; y: number; z: number; s: number; v: number }) {
  const verde = v > 0.75 ? '#3fbf3a' : '#4fcf3c'
  return (
    <group position={[x, y - 0.2, z]} scale={s} rotation-y={v * 6}>
      <mesh position-y={1.4} castShadow>
        <cylinderGeometry args={[0.32, 0.5, 2.8, 8]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>
      <mesh position-y={3.6} castShadow>
        <sphereGeometry args={[1.9, 14, 12]} />
        <meshStandardMaterial color={verde} />
      </mesh>
      <mesh position={[1.2, 3.1, 0.3]} castShadow>
        <sphereGeometry args={[1.3, 12, 10]} />
        <meshStandardMaterial color="#5fdc48" />
      </mesh>
      <mesh position={[-1.1, 3.2, -0.4]} castShadow>
        <sphereGeometry args={[1.4, 12, 10]} />
        <meshStandardMaterial color={verde} />
      </mesh>
      <mesh position={[0.2, 4.9, 0.1]} castShadow>
        <sphereGeometry args={[1.1, 12, 10]} />
        <meshStandardMaterial color="#6be653" />
      </mesh>
    </group>
  )
}

function Pino({ x, y, z, s }: { x: number; y: number; z: number; s: number }) {
  return (
    <group position={[x, y - 0.2, z]} scale={[s, s * 1.6, s]}>
      <mesh position-y={0.9} castShadow>
        <cylinderGeometry args={[0.3, 0.42, 1.8, 8]} />
        <meshStandardMaterial color="#7a4a22" />
      </mesh>
      {[0, 1, 2].map((n) => (
        <mesh key={n} position-y={2.3 + n * 1.35} castShadow>
          <coneGeometry args={[2.3 - n * 0.6, 2.4, 12]} />
          <meshStandardMaterial color={['#1f9e4a', '#27ad52', '#33bd5c'][n]} />
        </mesh>
      ))}
    </group>
  )
}

function Arbustos() {
  const arbustos = usarPuntos(13, 40, 0, 3)
  return (
    <group>
      {arbustos.map((a, i) => (
        <group key={i} position={[a.x, a.y, a.z]} scale={a.s * 0.8}>
          <mesh position-y={0.5} castShadow>
            <sphereGeometry args={[0.9, 10, 8]} />
            <meshStandardMaterial color="#3fbf3a" />
          </mesh>
          <mesh position={[0.7, 0.4, 0.2]} castShadow>
            <sphereGeometry args={[0.65, 10, 8]} />
            <meshStandardMaterial color="#52d043" />
          </mesh>
          {a.v > 0.5 && (
            <mesh position={[0.2, 1.2, 0.5]}>
              <sphereGeometry args={[0.18, 8, 6]} />
              <meshStandardMaterial color="#ff5d8f" />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

// Manchas de flores (instanciadas: cientos sin coste)
function Flores() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const flores = useMemo(() => {
    const azar = aleatorio(31)
    const colores = ['#ff5d8f', '#ffd43b', '#ffffff', '#b197fc', '#ff922b']
    const lista: { x: number; y: number; z: number; color: string }[] = []
    for (let parche = 0; parche < 26; parche++) {
      const ang = azar() * Math.PI * 2
      const r = 8 + azar() * (RADIO_ISLA - 14)
      const cx = Math.cos(ang) * r
      const cz = Math.sin(ang) * r
      const color = colores[parche % colores.length]
      for (let k = 0; k < 14; k++) {
        const x = cx + (azar() - 0.5) * 5
        const z = cz + (azar() - 0.5) * 5
        if (libre(x, z, -1.5)) lista.push({ x, y: alturaTerreno(x, z), z, color })
      }
    }
    return lista
  }, [])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    flores.forEach((f, i) => {
      m.setPosition(f.x, f.y + 0.25, f.z)
      ref.current!.setMatrixAt(i, m)
      ref.current!.setColorAt(i, c.set(f.color))
    })
    ref.current!.instanceMatrix.needsUpdate = true
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true
  }, [flores])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, flores.length]}>
      <sphereGeometry args={[0.2, 8, 6]} />
      <meshStandardMaterial />
    </instancedMesh>
  )
}

function Rocas() {
  const rocas = usarPuntos(21, 16, 0.5, 5)
  return (
    <group>
      {rocas.map((r, i) => (
        <mesh key={i} position={[r.x, r.y + r.s * 0.3, r.z]} scale={[r.s * 1.3, r.s, r.s]} rotation-y={r.v * 5} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#a3adba" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

// ---------- Construcciones del mapa ----------

function Casa({ x, z, color }: { x: number; z: number; color: string }) {
  const y = alturaTerreno(x, z)
  const giro = Math.atan2(-x, -z) // mira hacia el centro de la isla
  return (
    <group position={[x, y - 0.3, z]} rotation-y={giro}>
      <mesh position-y={0.3} receiveShadow>
        <boxGeometry args={[7.5, 0.6, 6.5]} />
        <meshStandardMaterial color="#c9ced6" />
      </mesh>
      <mesh position-y={2.4} castShadow receiveShadow>
        <boxGeometry args={[6.5, 3.6, 5.5]} />
        <meshStandardMaterial color="#fff4e0" />
      </mesh>
      {/* Tejado */}
      <mesh position-y={5.3} rotation-y={Math.PI / 4} scale={[1, 1, 0.85]} castShadow>
        <coneGeometry args={[5.4, 2.4, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Puerta y ventanas */}
      <mesh position={[0, 1.7, 2.76]}>
        <boxGeometry args={[1.3, 2.2, 0.1]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>
      {[-2.1, 2.1].map((wx) => (
        <mesh key={wx} position={[wx, 2.6, 2.76]}>
          <boxGeometry args={[1.3, 1.1, 0.1]} />
          <meshStandardMaterial color="#9fe3ff" emissive="#9fe3ff" emissiveIntensity={0.3} />
        </mesh>
      ))}
      <mesh position={[2, 6, -0.8]} castShadow>
        <boxGeometry args={[0.8, 1.8, 0.8]} />
        <meshStandardMaterial color="#b0703a" />
      </mesh>
    </group>
  )
}

function Muelle() {
  const ang = 2.4 // lado izquierdo-trasero de la isla
  const r = radioCosta(Math.cos(ang), Math.sin(ang)) - 3
  const x = Math.cos(ang) * r
  const z = Math.sin(ang) * r
  return (
    <group position={[x, NIVEL_AGUA + 0.7, z]} rotation-y={-ang + Math.PI / 2}>
      <mesh position-z={4} castShadow receiveShadow>
        <boxGeometry args={[3, 0.3, 12]} />
        <meshStandardMaterial color="#b0703a" />
      </mesh>
      {[0, 4, 8].map((pz) =>
        [-1.3, 1.3].map((px) => (
          <mesh key={`${px}${pz}`} position={[px, -0.8, pz]}>
            <cylinderGeometry args={[0.18, 0.18, 2, 8]} />
            <meshStandardMaterial color="#7a4a22" />
          </mesh>
        ))
      )}
      {/* Barquita */}
      <group position={[2.8, -0.4, 8]}>
        <RoundedBox args={[1.8, 0.8, 4]} radius={0.3} castShadow>
          <meshStandardMaterial color="#ff6b6b" />
        </RoundedBox>
      </group>
    </group>
  )
}

function IslasLejanas() {
  const islas: [number, number, number, string][] = [
    [-170, -140, 30, '#4fbf3a'],
    [190, -110, 24, '#5ccc40'],
    [-200, 90, 20, '#5ccc40'],
    [150, 170, 18, '#4fbf3a']
  ]
  return (
    <group>
      {islas.map(([x, z, r, c], i) => (
        <group key={i} position={[x, NIVEL_AGUA, z]}>
          <mesh position-y={1}>
            <cylinderGeometry args={[r, r + 4, 4, 24]} />
            <meshStandardMaterial color={c} />
          </mesh>
          <mesh position-y={3 + r * 0.45}>
            <coneGeometry args={[r * 0.8, r * 0.9, 7]} />
            <meshStandardMaterial color="#7c8a9a" />
          </mesh>
          <mesh position-y={3 + r * 0.82}>
            <coneGeometry args={[r * 0.28, r * 0.2, 7]} />
            <meshStandardMaterial color="white" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Nubes() {
  const nubes = useMemo(() => {
    const azar = aleatorio(99)
    return Array.from({ length: 12 }, () => ({
      x: -140 + azar() * 280,
      y: 58 + azar() * 22,
      z: -110 + azar() * 170,
      s: 1.2 + azar() * 1.6,
      v: 0.6 + azar() * 1.2
    }))
  }, [])
  return (
    <group>
      {nubes.map((n, i) => (
        <Nube key={i} {...n} />
      ))}
    </group>
  )
}

function Nube({ x, y, z, s, v }: { x: number; y: number; z: number; s: number; v: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.position.x += delta * v
    if (ref.current.position.x > 150) ref.current.position.x = -150
  })
  return (
    <group ref={ref} position={[x, y, z]} scale={s}>
      {[
        [0, 0, 0, 2.6],
        [-2.4, -0.4, 0.3, 1.9],
        [2.5, -0.3, -0.2, 2],
        [0.8, 1.2, 0.2, 1.8],
        [-1, 0.9, -0.5, 1.6]
      ].map(([px, py, pz, r], i) => (
        <mesh key={i} position={[px, py, pz]}>
          <sphereGeometry args={[r, 14, 10]} />
          <meshStandardMaterial color="white" />
        </mesh>
      ))}
    </group>
  )
}

// Paredes de roca en las laderas de las colinas, como los acantilados del mapa
function Acantilados() {
  const rocas: { p: [number, number, number]; s: [number, number, number]; g: number }[] = [
    { p: [-22, 0, -23.5], s: [7, 5, 3], g: 0.2 },
    { p: [-35, 0, -15], s: [6, 4, 3], g: 1.2 },
    { p: [22, 0, -24], s: [7, 4.5, 3], g: -0.3 },
    { p: [-5, 0, -29], s: [6, 4, 3], g: 0.15 },
    { p: [6, 0, -30], s: [6, 4.5, 3], g: -0.2 },
    { p: [-37, 0, -3], s: [5, 3.5, 3], g: 1.4 }
  ]
  return (
    <group>
      {rocas.map(({ p, s, g }, i) => {
        const y = alturaTerreno(p[0], p[2])
        return (
          <mesh key={i} position={[p[0], y + s[1] * 0.25, p[2]]} rotation-y={g} scale={s} castShadow receiveShadow>
            <dodecahedronGeometry args={[0.6, 0]} />
            <meshStandardMaterial map={textura('roca', 1.5, 1)} color="#b5aea8" flatShading />
          </mesh>
        )
      })}
    </group>
  )
}