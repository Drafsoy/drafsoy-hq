import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { ALTURA_VUELO } from './Autobus'

// ---------- Tarea nueva: cae en paracaídas sobre el piso del cliente ----------

const DURACION_CAIDA = 4.5

export function Paracaidas({ destino, color, alTerminar }: { destino: [number, number, number]; color: string; alTerminar: () => void }) {
  const ref = useRef<THREE.Group>(null)
  const inicio = useRef<number | null>(null)
  const terminado = useRef(false)

  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    if (inicio.current === null) inicio.current = clock.elapsedTime
    const t = (clock.elapsedTime - inicio.current) / DURACION_CAIDA
    const [x, y, z] = destino

    if (t < 0.85) {
      // Baja desde el autobús, balanceándose, hasta la mesa (la oficina no tiene techo)
      const p = t / 0.85
      const suave = 1 - (1 - p) ** 2
      const balanceo = Math.sin(p * 9) * 0.6 * (1 - p)
      g.position.set(x + balanceo, THREE.MathUtils.lerp(ALTURA_VUELO, y + 0.6, suave), z)
      g.rotation.z = Math.sin(p * 9) * 0.15 * (1 - p)
      g.scale.setScalar(1)
    } else if (t < 1) {
      // Aterriza y se "abre" (encoge) sobre la mesa
      const p = (t - 0.85) / 0.15
      g.position.set(x, y + 0.6, z)
      g.rotation.z = 0
      g.scale.setScalar(1 - p)
    } else if (!terminado.current) {
      terminado.current = true
      alTerminar()
    }
  })

  return (
    <group ref={ref} position={[destino[0], ALTURA_VUELO, destino[2]]} scale={0.7}>
      {/* Caja de suministros */}
      <RoundedBox args={[1.2, 1.2, 1.2]} radius={0.1} castShadow>
        <meshStandardMaterial color="#2f6bff" />
      </RoundedBox>
      <mesh>
        <boxGeometry args={[1.25, 0.25, 1.25]} />
        <meshStandardMaterial color="#ffc93c" />
      </mesh>
      {/* Cuerdas */}
      {[
        [-0.5, -0.5],
        [0.5, -0.5],
        [-0.5, 0.5],
        [0.5, 0.5]
      ].map(([cx, cz]) => (
        <mesh key={`${cx}${cz}`} position={[cx * 1.6, 1.9, cz * 1.6]} rotation={[cz * 0.5, 0, -cx * 0.5]}>
          <cylinderGeometry args={[0.03, 0.03, 2.6, 4]} />
          <meshBasicMaterial color="white" />
        </mesh>
      ))}
      {/* Paracaídas */}
      <mesh position-y={3}>
        <sphereGeometry args={[2.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      <mesh position-y={3} rotation-x={Math.PI / 2}>
        <torusGeometry args={[2.2, 0.08, 6, 24]} />
        <meshStandardMaterial color="white" />
      </mesh>
    </group>
  )
}

// ---------- Tarea completada: aparece un cofre dorado ----------

export function Cofre({ posicion, alAbrir }: { posicion: [number, number, number]; alAbrir: () => void }) {
  const grupo = useRef<THREE.Group>(null)
  const tapa = useRef<THREE.Group>(null)
  const luz = useRef<THREE.PointLight>(null)
  const [abierto, setAbierto] = useState(false)
  const abiertoEn = useRef<number | null>(null)
  const avisado = useRef(false)

  // Monedas que salen volando al abrirlo
  const monedas = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const ang = (i / 14) * Math.PI * 2
        return new THREE.Vector3(Math.cos(ang) * 1.6, 3 + (i % 3), Math.sin(ang) * 1.6)
      }),
    []
  )
  const refsMonedas = useRef<(THREE.Mesh | null)[]>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (grupo.current && !abierto) {
      grupo.current.position.y = posicion[1] + 0.15 + Math.sin(t * 3) * 0.12
      grupo.current.rotation.y = Math.sin(t * 1.5) * 0.3
    }
    if (luz.current) luz.current.intensity = 4 + Math.sin(t * 6) * 1.5

    if (abierto) {
      if (abiertoEn.current === null) abiertoEn.current = t
      const p = t - abiertoEn.current
      if (tapa.current) tapa.current.rotation.x = Math.max(-1.9, -p * 6)
      refsMonedas.current.forEach((m, i) => {
        if (!m) return
        const v = monedas[i]
        m.visible = true
        m.position.set(v.x * p, 0.8 + v.y * p - 4.9 * p * p, v.z * p)
        m.rotation.y = t * 8
      })
      if (p > 1.4 && !avisado.current) {
        avisado.current = true
        alAbrir()
      }
    }
  })

  return (
    <group
      ref={grupo}
      position={posicion}
      onClick={(e) => {
        e.stopPropagation()
        setAbierto(true)
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <pointLight ref={luz} color="#ffc93c" distance={6} position-y={1.5} />
      <RoundedBox args={[1.4, 0.8, 0.9]} radius={0.08} position-y={0.4} castShadow>
        <meshStandardMaterial color="#ffb300" metalness={0.6} roughness={0.25} emissive="#ff9900" emissiveIntensity={0.25} />
      </RoundedBox>
      <group ref={tapa} position={[0, 0.8, -0.45]}>
        <RoundedBox args={[1.45, 0.4, 0.95]} radius={0.12} position={[0, 0.2, 0.45]} castShadow>
          <meshStandardMaterial color="#ffd23f" metalness={0.6} roughness={0.25} emissive="#ff9900" emissiveIntensity={0.3} />
        </RoundedBox>
      </group>
      <mesh position={[0, 0.75, 0.47]}>
        <boxGeometry args={[0.25, 0.3, 0.06]} />
        <meshStandardMaterial color="#7c3aed" />
      </mesh>
      {monedas.map((_, i) => (
        <mesh key={i} ref={(m) => void (refsMonedas.current[i] = m)} visible={false} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.18, 0.18, 0.05, 12]} />
          <meshStandardMaterial color="#ffd23f" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      {!abierto && (
        <Html position={[0, 1.9, 0]} center distanceFactor={14}>
          <div className="titulo-juego pointer-events-none animate-pulse rounded-lg bg-oro px-2 py-0.5 text-sm whitespace-nowrap text-noche">
            ¡Ábreme!
          </div>
        </Html>
      )}
    </group>
  )
}
