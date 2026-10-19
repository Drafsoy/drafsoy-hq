import { useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { textura } from './texturas'

// Piezas reutilizables del pueblo: ventanas, toldos, mobiliario urbano y vehículos.

type V3 = [number, number, number]
const VIDRIO = '#8fcff0'

// ---------- Ventanas ----------

const geometriasArco = new Map<string, THREE.ShapeGeometry>()
function geometriaArco(ancho: number, alto: number) {
  const clave = `${ancho}:${alto}`
  let g = geometriasArco.get(clave)
  if (!g) {
    const r = ancho / 2
    const s = new THREE.Shape()
    s.moveTo(-r, 0)
    s.lineTo(r, 0)
    s.lineTo(r, alto - r)
    s.absarc(0, alto - r, r, 0, Math.PI, false)
    s.lineTo(-r, 0)
    g = new THREE.ShapeGeometry(s, 20)
    geometriasArco.set(clave, g)
  }
  return g
}

// Ventana con arco (origen abajo al centro, mirando a +z)
export function VentanaArco({ ancho, alto, marco = '#3f4650', position, rotation }: { ancho: number; alto: number; marco?: string; position?: V3; rotation?: V3 }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geometriaArco(ancho + 0.3, alto + 0.15)} position={[0, -0.08, 0]}>
        <meshStandardMaterial color="#e9e1cf" />
      </mesh>
      <mesh geometry={geometriaArco(ancho + 0.08, alto + 0.04)} position={[0, -0.02, 0.01]}>
        <meshStandardMaterial color={marco} />
      </mesh>
      <mesh geometry={geometriaArco(ancho - 0.12, alto - 0.12)} position={[0, 0.06, 0.02]}>
        <meshStandardMaterial color={VIDRIO} emissive={VIDRIO} emissiveIntensity={0.35} roughness={0.1} />
      </mesh>
      <mesh position={[0, alto / 2, 0.04]}>
        <boxGeometry args={[0.07, alto - 0.1, 0.03]} />
        <meshStandardMaterial color={marco} />
      </mesh>
      <mesh position={[0, alto - ancho / 2, 0.04]}>
        <boxGeometry args={[ancho - 0.1, 0.07, 0.03]} />
        <meshStandardMaterial color={marco} />
      </mesh>
    </group>
  )
}

// Ventana rectangular con dintel y alféizar de piedra
export function VentanaRect({ ancho, alto, marco = '#f1f1ef', position, rotation }: { ancho: number; alto: number; marco?: string; position?: V3; rotation?: V3 }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, alto / 2, 0]}>
        <boxGeometry args={[ancho + 0.16, alto + 0.16, 0.06]} />
        <meshStandardMaterial color={marco} />
      </mesh>
      <mesh position={[0, alto / 2, 0.03]}>
        <boxGeometry args={[ancho - 0.08, alto - 0.08, 0.04]} />
        <meshStandardMaterial color={VIDRIO} emissive={VIDRIO} emissiveIntensity={0.3} roughness={0.1} />
      </mesh>
      <mesh position={[0, alto / 2, 0.06]}>
        <boxGeometry args={[ancho - 0.1, 0.06, 0.03]} />
        <meshStandardMaterial color={marco} />
      </mesh>
      <mesh position={[0, alto + 0.15, 0.05]}>
        <boxGeometry args={[ancho + 0.4, 0.18, 0.18]} />
        <meshStandardMaterial color="#e9e1cf" />
      </mesh>
      <mesh position={[0, -0.08, 0.06]}>
        <boxGeometry args={[ancho + 0.3, 0.12, 0.22]} />
        <meshStandardMaterial color="#e9e1cf" />
      </mesh>
    </group>
  )
}

// Toldo de rayas inclinado (mira a +z)
export function Toldo({ ancho, color = 'rojo', position, rotation }: { ancho: number; color?: 'rojo' | 'verde'; position?: V3; rotation?: V3 }) {
  const mapa = textura(color === 'rojo' ? 'toldoRojo' : 'toldoVerde', ancho / 1.6, 1)
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, 0.55]} rotation-x={0.6} castShadow>
        <boxGeometry args={[ancho, 0.06, 1.3]} />
        <meshStandardMaterial map={mapa} />
      </mesh>
      <mesh position={[0, -0.38, 1.08]}>
        <boxGeometry args={[ancho, 0.3, 0.04]} />
        <meshStandardMaterial map={mapa} />
      </mesh>
    </group>
  )
}

// ---------- Mobiliario urbano ----------

export function Farola({ position, giro = 0 }: { position: V3; giro?: number }) {
  return (
    <group position={position} rotation-y={giro}>
      <mesh position-y={0.2}>
        <cylinderGeometry args={[0.25, 0.3, 0.4, 10]} />
        <meshStandardMaterial color="#4a4f57" />
      </mesh>
      <mesh position-y={3} castShadow>
        <cylinderGeometry args={[0.09, 0.13, 6, 8]} />
        <meshStandardMaterial color="#8a9099" />
      </mesh>
      <mesh position={[0.6, 5.95, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.06, 0.06, 1.3, 6]} />
        <meshStandardMaterial color="#8a9099" />
      </mesh>
      <mesh position={[1.25, 5.85, 0]}>
        <boxGeometry args={[0.8, 0.2, 0.4]} />
        <meshStandardMaterial color="#6b7280" />
      </mesh>
      <mesh position={[1.25, 5.73, 0]}>
        <boxGeometry args={[0.6, 0.05, 0.3]} />
        <meshStandardMaterial color="#fff9db" emissive="#ffe8a3" emissiveIntensity={1} />
      </mesh>
    </group>
  )
}

export function Banco({ position, giro = 0 }: { position: V3; giro?: number }) {
  return (
    <group position={position} rotation-y={giro}>
      {[0, 0.22].map((z) => (
        <mesh key={z} position={[0, 0.55, z - 0.1]} castShadow>
          <boxGeometry args={[2.2, 0.08, 0.18]} />
          <meshStandardMaterial color="#9a5b2c" />
        </mesh>
      ))}
      {[0.8, 1.05].map((y) => (
        <mesh key={y} position={[0, y, -0.3]} castShadow>
          <boxGeometry args={[2.2, 0.16, 0.06]} />
          <meshStandardMaterial color="#9a5b2c" />
        </mesh>
      ))}
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} position={[x, 0.45, -0.05]}>
          <boxGeometry args={[0.08, 0.9, 0.55]} />
          <meshStandardMaterial color="#2b2f36" />
        </mesh>
      ))}
    </group>
  )
}

export function Papelera({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <mesh position-y={0.5} castShadow>
        <cylinderGeometry args={[0.32, 0.28, 1, 12, 1, true]} />
        <meshStandardMaterial color="#6b7280" side={THREE.DoubleSide} wireframe={false} />
      </mesh>
      <mesh position-y={1}>
        <torusGeometry args={[0.32, 0.04, 6, 16]} />
        <meshStandardMaterial color="#4b5563" />
      </mesh>
    </group>
  )
}

export function Buzon({ position, giro = 0 }: { position: V3; giro?: number }) {
  return (
    <group position={position} rotation-y={giro}>
      <mesh position-y={0.55} castShadow>
        <boxGeometry args={[0.6, 0.9, 0.55]} />
        <meshStandardMaterial color="#1c64c8" />
      </mesh>
      <mesh position-y={1} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.275, 0.275, 0.6, 14, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#1c64c8" />
      </mesh>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.06, 0]}>
          <boxGeometry args={[0.08, 0.12, 0.45]} />
          <meshStandardMaterial color="#1a3f7a" />
        </mesh>
      ))}
    </group>
  )
}

export function Contenedor({ position, giro = 0 }: { position: V3; giro?: number }) {
  return (
    <group position={position} rotation-y={giro}>
      <mesh position-y={0.75} castShadow>
        <boxGeometry args={[1.8, 1.3, 1.2]} />
        <meshStandardMaterial color="#2f8a4f" />
      </mesh>
      <mesh position={[0, 1.45, -0.05]} rotation-x={-0.08}>
        <boxGeometry args={[1.9, 0.08, 1.3]} />
        <meshStandardMaterial color="#25703f" />
      </mesh>
    </group>
  )
}

export function Seto({ position, tam }: { position: V3; tam: V3 }) {
  return (
    <RoundedBox args={tam} radius={0.25} position={[position[0], position[1] + tam[1] / 2, position[2]]} castShadow>
      <meshStandardMaterial color="#3f8f2e" roughness={0.9} />
    </RoundedBox>
  )
}

// Árbol de otoño naranja
export function ArbolOtono({ position, escala = 1 }: { position: V3; escala?: number }) {
  return (
    <group position={position} scale={escala}>
      <mesh position-y={1.3} castShadow>
        <cylinderGeometry args={[0.15, 0.22, 2.6, 7]} />
        <meshStandardMaterial color="#7a5233" />
      </mesh>
      {(
        [
          [0, 3, 0, 1.1],
          [0.7, 2.6, 0.2, 0.75],
          [-0.6, 2.7, -0.3, 0.8],
          [0.1, 3.8, 0.1, 0.7]
        ] as const
      ).map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={i % 2 ? '#f0a03c' : '#e57a2c'} flatShading />
        </mesh>
      ))}
    </group>
  )
}

// ---------- Vehículos ----------

function Ruedas({ ancho, largo }: { ancho: number; largo: number }) {
  return (
    <>
      {[-1, 1].map((lx) =>
        [-1, 1].map((lz) => (
          <mesh key={`${lx}${lz}`} position={[(lx * ancho) / 2, 0.42, (lz * largo) / 2]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.42, 0.42, 0.32, 14]} />
            <meshStandardMaterial color="#1f2328" />
          </mesh>
        ))
      )}
    </>
  )
}

export function Camioneta({ position, giro = 0, color = '#5b3b8c' }: { position: V3; giro?: number; color?: string }) {
  return (
    <group position={position} rotation-y={giro}>
      <RoundedBox args={[2, 0.8, 4.6]} radius={0.2} position-y={0.85} castShadow>
        <meshStandardMaterial color={color} roughness={0.35} />
      </RoundedBox>
      <RoundedBox args={[1.9, 0.9, 1.6]} radius={0.2} position={[0, 1.65, 0.6]} castShadow>
        <meshStandardMaterial color={color} roughness={0.35} />
      </RoundedBox>
      <mesh position={[0, 1.7, 1.42]}>
        <boxGeometry args={[1.6, 0.6, 0.04]} />
        <meshStandardMaterial color={VIDRIO} roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.15, -1.1]}>
        <boxGeometry args={[1.8, 0.12, 2.2]} />
        <meshStandardMaterial color="#3a2a5c" />
      </mesh>
      <Ruedas ancho={2} largo={3} />
    </group>
  )
}

export function Autocaravana({ position, giro = 0 }: { position: V3; giro?: number }) {
  return (
    <group position={position} rotation-y={giro}>
      <RoundedBox args={[2.4, 2.4, 5.6]} radius={0.35} position-y={1.75} castShadow>
        <meshStandardMaterial color="#f3c6e8" roughness={0.4} />
      </RoundedBox>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[2.42, 0.3, 5.4]} />
        <meshStandardMaterial color="#c2549d" />
      </mesh>
      <mesh position={[0, 2.25, 2.81]}>
        <boxGeometry args={[2, 0.8, 0.04]} />
        <meshStandardMaterial color={VIDRIO} roughness={0.1} />
      </mesh>
      {[-1.6, 0, 1.6].map((z) => (
        <mesh key={z} position={[1.21, 2.2, z]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[0.9, 0.6]} />
          <meshStandardMaterial color={VIDRIO} />
        </mesh>
      ))}
      <Ruedas ancho={2.4} largo={3.8} />
    </group>
  )
}

export function AutobusEscolar({ position, giro = 0 }: { position: V3; giro?: number }) {
  return (
    <group position={position} rotation-y={giro}>
      <RoundedBox args={[2.5, 2.4, 8]} radius={0.3} position-y={1.75} castShadow>
        <meshStandardMaterial color="#f5c518" roughness={0.4} />
      </RoundedBox>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[2.52, 0.12, 7.8]} />
        <meshStandardMaterial color="#1f2328" />
      </mesh>
      {[-3, -1.8, -0.6, 0.6, 1.8].map((z) =>
        [-1.26, 1.26].map((x) => (
          <mesh key={`${x}${z}`} position={[x, 2.3, z]} rotation-y={(Math.sign(x) * Math.PI) / 2}>
            <planeGeometry args={[1, 0.7]} />
            <meshStandardMaterial color="#2b3138" side={THREE.DoubleSide} />
          </mesh>
        ))
      )}
      <Ruedas ancho={2.5} largo={5.6} />
    </group>
  )
}

export function Taxi({ position, giro = 0 }: { position: V3; giro?: number }) {
  return (
    <group position={position} rotation-y={giro}>
      <RoundedBox args={[1.9, 0.75, 4.3]} radius={0.25} position-y={0.8} castShadow>
        <meshStandardMaterial color="#f7c600" roughness={0.3} />
      </RoundedBox>
      <RoundedBox args={[1.7, 0.7, 2.1]} radius={0.25} position={[0, 1.45, -0.2]} castShadow>
        <meshStandardMaterial color={VIDRIO} roughness={0.1} />
      </RoundedBox>
      <mesh position={[0, 1.9, -0.2]}>
        <boxGeometry args={[0.6, 0.2, 0.3]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <Ruedas ancho={1.9} largo={2.8} />
    </group>
  )
}

// Hook para materiales con textura según el tamaño real de la pieza
export function usarMapa(nombre: Parameters<typeof textura>[0], ancho: number, alto: number, tile = 3) {
  return useMemo(() => textura(nombre, Math.max(ancho / tile, 0.5), Math.max(alto / tile, 0.5)), [nombre, ancho, alto, tile])
}
