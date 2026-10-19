import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

export const ALTURA_VUELO = 44
const RADIO_VUELO = 52

// Autobús volador colgado de un globo, dando vueltas sobre la isla.
export default function Autobus() {
  const ref = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime * 0.07
    g.position.set(Math.cos(t) * RADIO_VUELO, ALTURA_VUELO + Math.sin(clock.elapsedTime * 0.8) * 0.8, Math.sin(t) * RADIO_VUELO)
    g.rotation.y = -t // mira hacia donde avanza
    g.rotation.z = Math.sin(clock.elapsedTime * 0.8) * 0.04
  })

  return (
    <group ref={ref}>
      {/* Carrocería */}
      <RoundedBox args={[2.8, 2.6, 7]} radius={0.35} castShadow>
        <meshStandardMaterial color="#2f6bff" roughness={0.4} />
      </RoundedBox>
      <mesh position-y={1.35}>
        <boxGeometry args={[2.6, 0.12, 6.6]} />
        <meshStandardMaterial color="#ffc93c" />
      </mesh>
      {/* Ventanas */}
      {[-1, 1].map((lado) =>
        [-2.2, -0.7, 0.8, 2.3].map((z) => (
          <mesh key={`${lado}${z}`} position={[lado * 1.41, 0.45, z]} rotation-y={(lado * Math.PI) / 2}>
            <planeGeometry args={[1.1, 0.8]} />
            <meshStandardMaterial color="#bfe9ff" emissive="#bfe9ff" emissiveIntensity={0.4} side={THREE.DoubleSide} />
          </mesh>
        ))
      )}
      <mesh position={[0, 0.45, 3.51]}>
        <planeGeometry args={[2.2, 0.9]} />
        <meshStandardMaterial color="#bfe9ff" emissive="#bfe9ff" emissiveIntensity={0.4} />
      </mesh>
      {/* Ruedas */}
      {[-1.2, 1.2].map((x) =>
        [-2.3, 2.3].map((z) => (
          <mesh key={`${x}${z}`} position={[x, -1.3, z]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.55, 0.55, 0.4, 14]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
        ))
      )}
      {/* Cuerdas y globo */}
      {[
        [-1.2, -3],
        [1.2, -3],
        [-1.2, 3],
        [1.2, 3]
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x * 0.6, 4, z * 0.4]} rotation={[(-z / 3) * 0.35, 0, (x / 1.2) * 0.12]}>
          <cylinderGeometry args={[0.04, 0.04, 5.6, 4]} />
          <meshStandardMaterial color="#6b4423" />
        </mesh>
      ))}
      <mesh position-y={9.5} castShadow>
        <sphereGeometry args={[4.2, 24, 18]} />
        <meshStandardMaterial color="#2f6bff" roughness={0.5} />
      </mesh>
      {[-1.6, 0, 1.6].map((y) => (
        <mesh key={y} position-y={9.5 + y} rotation-x={Math.PI / 2}>
          <torusGeometry args={[Math.sqrt(4.25 ** 2 - y ** 2), 0.18, 8, 32]} />
          <meshStandardMaterial color="white" />
        </mesh>
      ))}
    </group>
  )
}
