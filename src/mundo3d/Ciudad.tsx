import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PLAZA } from './terreno'
import { textura } from './texturas'
import {
  ArbolOtono,
  Autocaravana,
  AutobusEscolar,
  Banco,
  Buzon,
  Camioneta,
  Contenedor,
  Farola,
  Papelera,
  Seto,
  Taxi,
  Toldo,
  VentanaArco,
  VentanaRect
} from './Detalles'

const PIEDRA_REMATE = '#e9e1cf'

// El pueblo alrededor de la agencia Drafsoy, recreando Tilted Towers.
export default function Ciudad() {
  const ancho = PLAZA.xMax - PLAZA.xMin
  const fondo = PLAZA.zMax - PLAZA.zMin
  const cx = (PLAZA.xMin + PLAZA.xMax) / 2
  const cz = (PLAZA.zMin + PLAZA.zMax) / 2

  return (
    <group>
      {/* Aceras de losas y calzada de asfalto */}
      <mesh position={[cx, 0.03, cz]} receiveShadow>
        <boxGeometry args={[ancho + 1.6, 0.1, fondo + 1.6]} />
        <meshStandardMaterial map={textura('losas', (ancho + 1.6) / 3, (fondo + 1.6) / 3)} />
      </mesh>
      {/* Calle delantera (a lo largo) y calle lateral derecha */}
      <mesh position={[cx, 0.1, 9.2]} receiveShadow>
        <boxGeometry args={[ancho, 0.04, 4.6]} />
        <meshStandardMaterial map={textura('asfalto', ancho / 8, 4.6 / 8)} />
      </mesh>
      <mesh position={[PLAZA.xMax - 2.6, 0.1, cz - 2]} receiveShadow>
        <boxGeometry args={[4.6, 0.04, fondo - 4]} />
        <meshStandardMaterial map={textura('asfalto', 4.6 / 8, (fondo - 4) / 8)} />
      </mesh>
      {/* Líneas de la calle */}
      {Array.from({ length: 11 }, (_, i) => PLAZA.xMin + 2.5 + i * 4.4).map((x) =>
        Math.abs(x) < 3 ? null : (
          <mesh key={x} position={[x, 0.13, 9.2]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[2.2, 0.22]} />
            <meshStandardMaterial color="#f1f3f5" />
          </mesh>
        )
      )}
      {[-1.6, -0.8, 0, 0.8, 1.6].map((x) => (
        <mesh key={x} position={[x, 0.13, 9.2]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.45, 3.6]} />
          <meshStandardMaterial color="white" />
        </mesh>
      ))}

      {/* Torre del reloj (detrás a la derecha) */}
      <TorreReloj x={21.5} z={-13} alto={24} />

      {/* Casa azul de tablas sobre base de ladrillo */}
      <CasaAzul x={23.8} z={-3} giro={-Math.PI / 2} />

      {/* Edificio de ladrillo (izquierda, detrás) */}
      <EdificioLadrillo x={-23} z={-12} />

      {/* Parque cuadrado con adoquín rojo */}
      <Parque x={-23.5} z={1} />

      {/* Muro de contención de hormigón al fondo */}
      <mesh position={[0, 1, PLAZA.zMin - 0.3]} castShadow receiveShadow>
        <boxGeometry args={[ancho, 2, 0.6]} />
        <meshStandardMaterial map={textura('concreto', ancho / 6, 0.4)} />
      </mesh>

      {/* Farolas, mobiliario y vehículos (acera delantera, al otro lado de la calle) */}
      {[-26, -15, -4, 7, 18, 27].map((x) => (
        <Farola key={x} position={[x, 0.08, 12.4]} giro={Math.PI / 2} />
      ))}
      <Banco position={[-9, 0.08, 12.5]} giro={Math.PI} />
      <Banco position={[12, 0.08, 12.5]} giro={Math.PI} />
      <Papelera position={[-12, 0.08, 12.5]} />
      <Papelera position={[2, 0.08, 12.5]} />
      <Buzon position={[-6.5, 0.08, 12.6]} giro={Math.PI} />
      <Contenedor position={[17, 0.08, -17.5]} />
      <Contenedor position={[-17, 0.08, -17.5]} />
      <Camioneta position={[-14, 0.1, 10.6]} giro={Math.PI / 2} />
      <Autocaravana position={[-25, 0.1, 9.4]} giro={Math.PI / 2} />
      <AutobusEscolar position={[29.4, 0.1, -6]} giro={0} />
      <Taxi position={[13.5, 0.1, 8]} giro={-Math.PI / 2} />    </group>
  )
}

// ---------- Torre del reloj (piedra clara, campanario con arcos, reloj dorado) ----------

function TorreReloj({ x, z, alto }: { x: number; z: number; alto: number }) {
  const horario = useRef<(THREE.Group | null)[]>([])
  const minutero = useRef<(THREE.Group | null)[]>([])

  useFrame(() => {
    const ahora = new Date()
    const min = ahora.getMinutes() + ahora.getSeconds() / 60
    const hora = (ahora.getHours() % 12) + min / 60
    horario.current.forEach((g) => g && (g.rotation.z = -(hora / 12) * Math.PI * 2))
    minutero.current.forEach((g) => g && (g.rotation.z = -(min / 60) * Math.PI * 2))
  })

  const fuste = alto - 8 // cuerpo hasta el reloj
  const lado = 4
  const piedra = (alto: number) => textura('piedraClara', lado / 2, alto / 2.2)

  return (
    <group position={[x, 0, z]}>
      {/* Base algo más ancha */}
      <mesh position-y={1.6} castShadow receiveShadow>
        <boxGeometry args={[lado + 0.8, 3.2, lado + 0.8]} />
        <meshStandardMaterial map={piedra(3.2)} />
      </mesh>
      <mesh position-y={3.3}>
        <boxGeometry args={[lado + 1, 0.3, lado + 1]} />
        <meshStandardMaterial color={PIEDRA_REMATE} />
      </mesh>
      {/* Fuste */}
      <mesh position-y={fuste / 2} castShadow receiveShadow>
        <boxGeometry args={[lado, fuste, lado]} />
        <meshStandardMaterial map={piedra(fuste)} />
      </mesh>
      {/* Cuerpo del reloj */}
      <mesh position-y={fuste + 1.5} castShadow>
        <boxGeometry args={[lado + 0.5, 3, lado + 0.5]} />
        <meshStandardMaterial map={piedra(3)} />
      </mesh>
      {[fuste, fuste + 3].map((y) => (
        <mesh key={y} position-y={y}>
          <boxGeometry args={[lado + 0.8, 0.3, lado + 0.8]} />
          <meshStandardMaterial color={PIEDRA_REMATE} />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((cara) => (
        <group key={cara} rotation-y={(cara * Math.PI) / 2}>
          <group position={[0, fuste + 1.5, (lado + 0.5) / 2 + 0.02]}>
            <mesh>
              <circleGeometry args={[1.15, 40]} />
              <meshStandardMaterial color="#fbfaf5" emissive="#fff8e1" emissiveIntensity={0.2} />
            </mesh>
            <mesh position-z={0.03}>
              <torusGeometry args={[1.2, 0.12, 10, 40]} />
              <meshStandardMaterial color="#c9952e" metalness={0.7} roughness={0.3} />
            </mesh>
            {Array.from({ length: 12 }, (_, i) => (
              <mesh key={i} position={[Math.sin((i / 12) * Math.PI * 2) * 0.95, Math.cos((i / 12) * Math.PI * 2) * 0.95, 0.02]}>
                <boxGeometry args={[0.06, 0.16, 0.02]} />
                <meshStandardMaterial color="#2b2b2b" />
              </mesh>
            ))}
            <group ref={(g) => void (horario.current[cara] = g)} position-z={0.04}>
              <mesh position-y={0.3}>
                <boxGeometry args={[0.1, 0.6, 0.03]} />
                <meshStandardMaterial color="#1a1a1a" />
              </mesh>
            </group>
            <group ref={(g) => void (minutero.current[cara] = g)} position-z={0.06}>
              <mesh position-y={0.42}>
                <boxGeometry args={[0.07, 0.84, 0.03]} />
                <meshStandardMaterial color="#1a1a1a" />
              </mesh>
            </group>
          </group>
        </group>
      ))}
      {/* Campanario con arcos abiertos */}
      <group position-y={fuste + 3.15}>
        {[-1, 1].map((lx) =>
          [-1, 1].map((lz) => (
            <mesh key={`${lx}${lz}`} position={[lx * 1.8, 1.4, lz * 1.8]} castShadow>
              <boxGeometry args={[0.9, 2.8, 0.9]} />
              <meshStandardMaterial map={textura('piedraClara', 0.4, 1.2)} />
            </mesh>
          ))
        )}
        {[0, 1, 2, 3].map((cara) => (
          <group key={cara} rotation-y={(cara * Math.PI) / 2}>
            {/* Arco de piedra sobre la abertura con barrotes de madera */}
            <mesh position={[0, 2.5, 1.9]}>
              <boxGeometry args={[2.8, 0.6, 0.5]} />
              <meshStandardMaterial color={PIEDRA_REMATE} />
            </mesh>
            <VentanaArco ancho={2.6} alto={2.2} marco="#6b4a2f" position={[0, 0.1, 1.6]} />
          </group>
        ))}
        <mesh position-y={1}>
          <cylinderGeometry args={[0.7, 0.9, 1.4, 12]} />
          <meshStandardMaterial color="#a4772f" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position-y={3}>
          <boxGeometry args={[lado + 1, 0.4, lado + 1]} />
          <meshStandardMaterial color={PIEDRA_REMATE} />
        </mesh>
        {/* Tejado piramidal de tejas */}
        <mesh position-y={4.4} rotation-y={Math.PI / 4} castShadow>
          <coneGeometry args={[3.5, 2.6, 4]} />
          <meshStandardMaterial map={textura('tejas', 2, 1.4)} flatShading />
        </mesh>
        <mesh position-y={5.85}>
          <boxGeometry args={[0.35, 0.35, 0.35]} />
          <meshStandardMaterial color="#8a6a4a" />
        </mesh>
      </group>
    </group>
  )
}

// ---------- Casa azul de tablas (base de ladrillo, mirador, cornisa blanca) ----------

function CasaAzul({ x, z, giro }: { x: number; z: number; giro: number }) {
  const ancho = 8
  const fondo = 6.5
  return (
    <group position={[x, 0, z]} rotation-y={giro}>
      {/* Planta baja de ladrillo */}
      <mesh position-y={1.6} castShadow receiveShadow>
        <boxGeometry args={[ancho, 3.2, fondo]} />
        <meshStandardMaterial map={textura('ladrillo', ancho / 2.2, 3.2 / 2.2)} />
      </mesh>
      {/* Plantas altas de tablas azules */}
      <mesh position-y={3.2 + 2.8} castShadow receiveShadow>
        <boxGeometry args={[ancho, 5.6, fondo]} />
        <meshStandardMaterial map={textura('tablasAzules', ancho / 3, 5.6 / 3)} />
      </mesh>
      {/* Mirador saliente */}
      <mesh position={[ancho / 4, 6, fondo / 2 + 0.6]} castShadow>
        <boxGeometry args={[3, 5.4, 1.2]} />
        <meshStandardMaterial map={textura('tablasAzules', 1, 1.8)} />
      </mesh>
      {[4.6, 7.4].map((wy) =>
        [-0.9, 0.9].map((wx) => (
          <VentanaRect key={`${wy}${wx}`} ancho={0.9} alto={1.4} position={[ancho / 4 + wx, wy - 0.7, fondo / 2 + 1.22]} />
        ))
      )}
      {[4.6, 7.4].map((wy) => (
        <VentanaRect key={wy} ancho={1} alto={1.4} position={[-ancho / 4, wy - 0.7, fondo / 2 + 0.02]} />
      ))}
      {/* Cornisas blancas */}
      {[3.2, 8.8].map((y) => (
        <mesh key={y} position-y={y}>
          <boxGeometry args={[ancho + 0.5, 0.35, fondo + 0.5]} />
          <meshStandardMaterial color="#eef0f2" />
        </mesh>
      ))}
      <mesh position-y={9.2}>
        <boxGeometry args={[ancho + 0.2, 0.5, fondo + 0.2]} />
        <meshStandardMaterial color="#d7dadf" />
      </mesh>
      {/* Puerta de garaje y escaparate */}
      <mesh position={[-ancho / 4, 1.3, fondo / 2 + 0.02]}>
        <boxGeometry args={[2.6, 2.4, 0.05]} />
        <meshStandardMaterial color="#9aa1aa" />
      </mesh>
      <VentanaRect ancho={2.4} alto={1.8} marco="#6b4a2f" position={[ancho / 4, 0.6, fondo / 2 + 0.02]} />
    </group>
  )
}

// ---------- Edificio de ladrillo con columnas de piedra (como la torre de la referencia) ----------

function EdificioLadrillo({ x, z }: { x: number; z: number }) {
  const ancho = 7
  const fondo = 8
  const alto = 13
  const plantas = 4
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={alto / 2} castShadow receiveShadow>
        <boxGeometry args={[ancho, alto, fondo]} />
        <meshStandardMaterial map={textura('ladrillo', ancho / 2.2, alto / 2.2)} />
      </mesh>
      {/* Base de piedra beige */}
      <mesh position-y={1.8} castShadow>
        <boxGeometry args={[ancho + 0.15, 3.6, fondo + 0.15]} />
        <meshStandardMaterial map={textura('piedraBeige', ancho / 3, 3.6 / 2.2)} />
      </mesh>
      {/* Esquinas de piedra */}
      {[-1, 1].map((lx) =>
        [-1, 1].map((lz) => (
          <mesh key={`${lx}${lz}`} position={[(lx * ancho) / 2, alto / 2, (lz * fondo) / 2]} castShadow>
            <boxGeometry args={[0.8, alto, 0.8]} />
            <meshStandardMaterial map={textura('piedraBeige', 0.4, alto / 2.2)} />
          </mesh>
        ))
      )}
      {/* Ventanas en la fachada frontal y lateral derecha */}
      {Array.from({ length: plantas - 1 }, (_, p) => 4.6 + p * 2.9).map((wy) => (
        <group key={wy}>
          {[-1.6, 0, 1.6].map((wx) => (
            <VentanaRect key={wx} ancho={0.9} alto={1.5} marco="#5b4636" position={[wx, wy, fondo / 2 + 0.02]} />
          ))}
          {[-2.4, 0, 2.4].map((wz) => (
            <VentanaRect key={wz} ancho={0.9} alto={1.5} marco="#5b4636" position={[ancho / 2 + 0.02, wy, wz]} rotation={[0, Math.PI / 2, 0]} />
          ))}
        </group>
      ))}
      <Toldo ancho={5} color="verde" position={[0, 3.1, fondo / 2 + 0.08]} />
      <VentanaRect ancho={4.2} alto={2} marco="#2f7a3d" position={[0, 0.5, fondo / 2 + 0.09]} />
      {/* Cornisa superior */}
      <mesh position-y={alto + 0.2}>
        <boxGeometry args={[ancho + 0.8, 0.45, fondo + 0.8]} />
        <meshStandardMaterial color={PIEDRA_REMATE} />
      </mesh>
      {/* Aire acondicionado en la azotea */}
      <mesh position={[1.2, alto + 1, -1]} castShadow>
        <boxGeometry args={[1.6, 1.2, 1.4]} />
        <meshStandardMaterial color="#c9cdd3" />
      </mesh>
    </group>
  )
}

// ---------- Parque con adoquín rojo, césped, setos y árboles ----------

function Parque({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.11} receiveShadow>
        <boxGeometry args={[9, 0.06, 6.6]} />
        <meshStandardMaterial map={textura('adoquin', 9 / 2.5, 6.6 / 2.5)} />
      </mesh>
      {/* Jardinera central con bordillo */}
      <mesh position-y={0.3} receiveShadow>
        <boxGeometry args={[5.2, 0.4, 3.6]} />
        <meshStandardMaterial color={PIEDRA_REMATE} />
      </mesh>
      <mesh position-y={0.52} receiveShadow>
        <boxGeometry args={[4.8, 0.06, 3.2]} />
        <meshStandardMaterial color="#5aa83a" />
      </mesh>
      <Seto position={[-1.8, 0.5, -1.1]} tam={[1.2, 0.8, 0.9]} />
      <Seto position={[1.9, 0.5, 1.1]} tam={[1, 0.7, 0.9]} />
      {/* Árbol grande y frondoso */}
      <group position={[0, 0.5, 0]}>
        <mesh position-y={1.6} castShadow>
          <cylinderGeometry args={[0.25, 0.35, 3.2, 8]} />
          <meshStandardMaterial color="#7a5233" />
        </mesh>
        {(
          [
            [0, 4, 0, 1.9],
            [1.2, 3.5, 0.4, 1.3],
            [-1.1, 3.6, -0.3, 1.4],
            [0.2, 5.3, 0.2, 1.2]
          ] as const
        ).map(([px, py, pz, r], i) => (
          <mesh key={i} position={[px, py, pz]} castShadow>
            <icosahedronGeometry args={[r, 2]} />
            <meshStandardMaterial color={i % 2 ? '#4f9e34' : '#3f8a2a'} />
          </mesh>
        ))}
      </group>
      <ArbolOtono position={[-3.8, 0.12, 2.6]} escala={0.9} />
      <ArbolOtono position={[3.8, 0.12, -2.6]} escala={0.8} />
      <Banco position={[0, 0.12, 2.8]} giro={Math.PI} />
      <Seto position={[-4, 0.1, -2.7]} tam={[0.8, 0.7, 0.8]} />
      <Seto position={[4, 0.1, 2.7]} tam={[0.8, 0.7, 0.8]} />
    </group>
  )
}
