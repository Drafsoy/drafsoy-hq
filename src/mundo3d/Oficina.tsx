import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox, Text } from '@react-three/drei'
import * as THREE from 'three'
// Letreros con la misma tipografía del dashboard
import fuenteJuego from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff?url'
import type { Agente, Cliente, Tarea } from '@/datos/tipos'
import Minifig from './Minifig'
import { Toldo, VentanaRect } from './Detalles'
import { textura, texturaIcono } from './texturas'
import {
  ALTO_PARED,
  ALTO_TABIQUE,
  ANCHO_OFICINA,
  ANCHO_PUERTA,
  DIST_MESA,
  FONDO_OFICINA,
  GROSOR_SUELO,
  MESA_RAFA,
  MURO_APROBACIONES,
  OFICINAS,
  RECEPCION,
  SALAS,
  Z_CRISTAL_ATRAS,
  Z_CRISTAL_DELANTE,
  Z_OFICINA,
  aclarar,
  duenosDeOficinas,
  puestoDe,
  sala,
  type Sala
} from './medidas'

export { fuenteJuego }

export const PIEDRA = '#eadfc6'
const PINTURA = '#f3ece0'
const NOGAL = '#6f4a2f'
const NEGRO_MATE = '#23262b'
const MEDIO_ANCHO = ANCHO_OFICINA / 2
const MEDIO_FONDO = FONDO_OFICINA / 2
const ALTO_ZOCALO = 1.2
const ENTRADA: [number, number] = [-15.6, -12.4]

type V3 = [number, number, number]

// Oscurece un color
const oscurecer = (hex: string, k: number) => '#' + new THREE.Color(hex).multiplyScalar(1 - k).getHexString()

interface Props {
  agentes: Agente[]
  clientesPorAgente: Record<string, Cliente[]>
  tareaActual: Record<string, Tarea | undefined>
  pendientes: number
  bailando: Set<string>
  resaltados: Set<string>
  alClicAgente: (agente: Agente) => void
  alClicAprobaciones: () => void
}

// La agencia: oficinas privadas alrededor de un coworking, sin techo para verlo todo.
export default function Oficina(props: Props) {
  const { agentes, clientesPorAgente, tareaActual, bailando, resaltados, alClicAgente } = props
  const duenos = useMemo(() => duenosDeOficinas(agentes), [agentes])
  const empleados = agentes.filter((a) => !a.es_recepcionista && !a.es_supervisor)

  return (
    <group position={[0, 0, Z_OFICINA]}>
      <Estructura />
      <group position-y={GROSOR_SUELO}>
        <Suelos />
        <Paredes />
        <Cristaleras />

        {OFICINAS.map((s) => {
          const dueno = agentes.find((a) => a.id === duenos.get(s.id))
          return <OficinaPrivada key={s.id} sala={s} dueno={dueno} clientes={dueno ? (clientesPorAgente[dueno.id] ?? []) : []} />
        })}
        <Recepcion />
        <Despacho pendientes={props.pendientes} alClicAprobaciones={props.alClicAprobaciones} />
        <Coworking />

        {empleados.map((a) => (
          <Mesa
            key={a.id}
            agente={a}
            puesto={puestoDe(a, agentes)}
            clientes={clientesPorAgente[a.id] ?? []}
            tarea={tareaActual[a.id]}
            resaltada={resaltados.has(a.id)}
            alClic={() => alClicAgente(a)}
          />
        ))}

        {agentes.map((a) => (
          <Minifig
            key={a.id}
            agente={a}
            asiento={puestoDe(a, agentes)}
            conSilla={!a.es_recepcionista}
            bailando={bailando.has(a.id)}
            alClic={() => alClicAgente(a)}
          />
        ))}
      </group>
    </group>
  )
}

// ---------- Fachada exterior (estilo Tilted) ----------

function Estructura() {
  const muros: { pos: [number, number]; largo: number; giro: number }[] = [
    { pos: [0, -MEDIO_FONDO], largo: ANCHO_OFICINA, giro: 0 },
    { pos: [-MEDIO_ANCHO, 0], largo: FONDO_OFICINA, giro: Math.PI / 2 },
    { pos: [MEDIO_ANCHO, 0], largo: FONDO_OFICINA, giro: -Math.PI / 2 }
  ]
  return (
    <group>
      <mesh position-y={GROSOR_SUELO / 2} receiveShadow>
        <boxGeometry args={[ANCHO_OFICINA + 0.8, GROSOR_SUELO, FONDO_OFICINA + 0.8]} />
        <meshStandardMaterial map={textura('piedraBeige', ANCHO_OFICINA / 3, FONDO_OFICINA / 3)} />
      </mesh>
      {muros.map(({ pos, largo, giro }, i) => (
        <group key={i} position={[pos[0], GROSOR_SUELO, pos[1]]} rotation-y={giro}>
          <mesh position-y={ALTO_ZOCALO + (ALTO_PARED - ALTO_ZOCALO) / 2} castShadow receiveShadow>
            <boxGeometry args={[largo, ALTO_PARED - ALTO_ZOCALO, 0.5]} />
            <meshStandardMaterial map={textura('ladrillo', largo / 2.2, (ALTO_PARED - ALTO_ZOCALO) / 2.2)} />
          </mesh>
          <mesh position-y={ALTO_ZOCALO / 2} castShadow receiveShadow>
            <boxGeometry args={[largo, ALTO_ZOCALO, 0.56]} />
            <meshStandardMaterial map={textura('piedraBeige', largo / 3, ALTO_ZOCALO / 2.2)} />
          </mesh>
          <mesh position={[0, ALTO_PARED / 2, 0.29]}>
            <boxGeometry args={[largo - 0.6, ALTO_PARED, 0.02]} />
            <meshStandardMaterial color={PINTURA} />
          </mesh>
          <mesh position={[0, 0.12, 0.31]}>
            <boxGeometry args={[largo - 0.6, 0.24, 0.03]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          {Array.from({ length: Math.floor(largo / 4.25) }, (_, k) => (k + 0.5) * (largo / Math.floor(largo / 4.25)) - largo / 2).map((x) => (
            <group key={x}>
              <VentanaRect ancho={1.5} alto={1.5} marco="#5b4636" position={[x, 1.4, -0.3]} rotation={[0, Math.PI, 0]} />
              <mesh position={[x, 2.15, 0.31]}>
                <boxGeometry args={[1.5, 1.5, 0.02]} />
                <meshStandardMaterial color="#bfe6ff" emissive="#bfe6ff" emissiveIntensity={0.35} />
              </mesh>
            </group>
          ))}
          <mesh position-y={ALTO_PARED + 0.12}>
            <boxGeometry args={[largo + 0.6, 0.25, 0.9]} />
            <meshStandardMaterial color={PIEDRA} />
          </mesh>
        </group>
      ))}
      {[
        [-MEDIO_ANCHO, ENTRADA[0]],
        [ENTRADA[1], MEDIO_ANCHO]
      ].map(([a, b]) => (
        <group key={a} position={[(a + b) / 2, GROSOR_SUELO, MEDIO_FONDO]}>
          <mesh position-y={0.55} castShadow receiveShadow>
            <boxGeometry args={[b - a, 1.1, 0.5]} />
            <meshStandardMaterial map={textura('piedraBeige', (b - a) / 3, 0.5)} />
          </mesh>
          <mesh position-y={1.15}>
            <boxGeometry args={[b - a + 0.1, 0.12, 0.7]} />
            <meshStandardMaterial color={PIEDRA} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((lx) =>
        [-1, 1].map((lz) => (
          <mesh key={`${lx}${lz}`} position={[lx * MEDIO_ANCHO, GROSOR_SUELO + (lz > 0 ? 0.75 : ALTO_PARED / 2 + 0.1), lz * MEDIO_FONDO]} castShadow>
            <boxGeometry args={[1, lz > 0 ? 1.5 : ALTO_PARED + 0.2, 1]} />
            <meshStandardMaterial map={textura('piedraBeige', 0.4, 1.4)} />
          </mesh>
        ))
      )}
      {/* Letrero de la fachada */}
      <group position={[-4.25, GROSOR_SUELO, MEDIO_FONDO + 0.35]}>
        <RoundedBox args={[8.4, 1.2, 0.25]} radius={0.12} position-y={1.75} castShadow>
          <meshStandardMaterial color="#1b1f4b" />
        </RoundedBox>
        <mesh position={[-3.3, 1.75, 0.14]}>
          <planeGeometry args={[0.9, 0.9]} />
          <meshStandardMaterial map={texturaIcono('⚡', '#ffc93c')} transparent />
        </mesh>
        <Text font={fuenteJuego} fontSize={0.78} color="#ffc93c" outlineWidth={0.04} outlineColor="#0b1f4d" position={[0.5, 1.75, 0.14]}>
          DRAFSOY HQ
        </Text>
      </group>
      <group position={[(ENTRADA[0] + ENTRADA[1]) / 2, GROSOR_SUELO, MEDIO_FONDO]}>
        {ENTRADA.map((x) => (
          <mesh key={x} position={[x - (ENTRADA[0] + ENTRADA[1]) / 2, 1.5, 0]} castShadow>
            <boxGeometry args={[0.6, 3, 0.6]} />
            <meshStandardMaterial map={textura('piedraBeige', 0.4, 1.2)} />
          </mesh>
        ))}
        <Toldo ancho={3.6} color="rojo" position={[0, 2.9, 0.1]} />
      </group>
    </group>
  )
}

function Suelos() {
  const recepcion = sala('recepcion')
  return (
    <group>
      {/* Parqué en oficinas */}
      <mesh position={[0, 0.01, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ANCHO_OFICINA - 0.6, FONDO_OFICINA - 0.6]} />
        <meshStandardMaterial map={textura('madera', (ANCHO_OFICINA - 0.6) / 2.4, (FONDO_OFICINA - 0.6) / 2.4)} />
      </mesh>
      {/* Microcemento claro en el coworking */}
      <mesh position={[0, 0.015, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ANCHO_OFICINA - 0.6, Z_CRISTAL_DELANTE - Z_CRISTAL_ATRAS - 0.2]} />
        <meshStandardMaterial color="#d9d4cb" roughness={0.6} />
      </mesh>
      {/* Mármol en recepción */}
      <mesh position={[(recepcion.x[0] + recepcion.x[1]) / 2 - 0.15, 0.016, (recepcion.z[0] + recepcion.z[1]) / 2]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[recepcion.x[1] - recepcion.x[0] - 0.3, recepcion.z[1] - recepcion.z[0] - 0.4]} />
        <meshStandardMaterial map={textura('losas', 4, 3)} color="#f4f1ec" roughness={0.3} />
      </mesh>
    </group>
  )
}

// Paredes opacas entre oficinas
function Paredes() {
  const tramos: { x: number; z: [number, number] }[] = []
  for (const x of [-8.5, 0, 8.5]) {
    tramos.push({ x, z: [-MEDIO_FONDO + 0.25, Z_CRISTAL_ATRAS] })
    tramos.push({ x, z: [Z_CRISTAL_DELANTE, MEDIO_FONDO - 0.25] })
  }
  return (
    <group>
      {tramos.map(({ x, z }) => (
        <group key={`${x}${z[0]}`} position={[x, 0, (z[0] + z[1]) / 2]}>
          <RoundedBox args={[0.24, ALTO_TABIQUE, z[1] - z[0]]} radius={0.05} position-y={ALTO_TABIQUE / 2} castShadow receiveShadow>
            <meshStandardMaterial color={PINTURA} />
          </RoundedBox>
          <mesh position-y={0.1}>
            <boxGeometry args={[0.28, 0.2, z[1] - z[0]]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position-y={ALTO_TABIQUE + 0.04}>
            <boxGeometry args={[0.3, 0.08, z[1] - z[0]]} />
            <meshStandardMaterial color={NEGRO_MATE} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Cristaleras entre las oficinas y el coworking, con su puerta
function Cristaleras() {
  const lineas = [
    { z: Z_CRISTAL_ATRAS, puertas: SALAS.filter((s) => s.tipo !== 'comun' && s.puerta[1] === Z_CRISTAL_ATRAS).map((s) => s.puerta[0]) },
    { z: Z_CRISTAL_DELANTE, puertas: SALAS.filter((s) => s.tipo !== 'comun' && s.puerta[1] === Z_CRISTAL_DELANTE).map((s) => s.puerta[0]) }
  ]
  return (
    <group>
      {lineas.map(({ z, puertas }) => {
        const tramos: [number, number][] = []
        let a = -MEDIO_ANCHO + 0.25
        for (const p of [...puertas].sort((m, n) => m - n)) {
          tramos.push([a, p - ANCHO_PUERTA / 2])
          a = p + ANCHO_PUERTA / 2
        }
        tramos.push([a, MEDIO_ANCHO - 0.25])
        return (
          <group key={z}>
            {tramos.map(([x0, x1]) => (
              <group key={x0}>
                <mesh position={[(x0 + x1) / 2, ALTO_TABIQUE / 2, z]}>
                  <boxGeometry args={[x1 - x0, ALTO_TABIQUE, 0.06]} />
                  <meshStandardMaterial color="#cfeeff" transparent opacity={0.22} roughness={0.05} metalness={0.1} />
                </mesh>
                {/* Perfiles negros */}
                {[0.04, ALTO_TABIQUE].map((y) => (
                  <mesh key={y} position={[(x0 + x1) / 2, y, z]}>
                    <boxGeometry args={[x1 - x0, 0.08, 0.1]} />
                    <meshStandardMaterial color={NEGRO_MATE} />
                  </mesh>
                ))}
                {Array.from({ length: Math.max(1, Math.round((x1 - x0) / 2.1)) + 1 }, (_, i) => x0 + (i * (x1 - x0)) / Math.max(1, Math.round((x1 - x0) / 2.1))).map((x) => (
                  <mesh key={x} position={[x, ALTO_TABIQUE / 2, z]}>
                    <boxGeometry args={[0.06, ALTO_TABIQUE, 0.1]} />
                    <meshStandardMaterial color={NEGRO_MATE} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        )
      })}
    </group>
  )
}

// Cartel sobre la puerta (mira hacia la calle)
function Cartel({ x, z, texto, icono, color, puntos = [], giro = 0 }: { x: number; z: number; texto: string; icono: string; color: string; puntos?: string[]; giro?: number }) {
  const ancho = texto.length * 0.25 + 1.5 + puntos.length * 0.32
  return (
    <group position={[x, ALTO_TABIQUE + 0.55, z + 0.05]} rotation-y={giro}>
      <RoundedBox args={[ancho, 0.85, 0.1]} radius={0.08} castShadow>
        <meshStandardMaterial color="#1b2152" />
      </RoundedBox>
      <mesh position={[0, -0.37, 0.055]}>
        <boxGeometry args={[ancho - 0.12, 0.07, 0.01]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[-ancho / 2 + 0.5, 0, 0.06]}>
        <planeGeometry args={[0.68, 0.68]} />
        <meshStandardMaterial map={texturaIcono(icono, color)} transparent />
      </mesh>
      <Text font={fuenteJuego} fontSize={0.36} color="white" anchorX="left" position={[-ancho / 2 + 0.95, 0.02, 0.06]}>
        {texto}
      </Text>
      {puntos.map((c, i) => (
        <mesh key={i} position={[ancho / 2 - 0.3 - i * 0.32, 0.02, 0.06]}>
          <circleGeometry args={[0.12, 16]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
    </group>
  )
}

// ---------- Oficina privada con diseño de interiorista ----------

function OficinaPrivada({ sala: s, dueno, clientes }: { sala: Sala; dueno?: Agente; clientes: Cliente[] }) {
  const tema = dueno?.color ?? '#adb5bd'
  const acento = aclarar(tema, 0.55)
  const alfombra = oscurecer(tema, 0.35)
  const cx = (s.x[0] + s.x[1]) / 2
  const atras = s.z[1] <= Z_CRISTAL_ATRAS + 0.01
  // "Fondo" de la oficina: la pared opuesta a la puerta
  const zFondo = atras ? s.z[0] + 0.32 : s.z[1] - 0.3
  const [, sz] = s.puestos[0]

  return (
    <group>
      {/* Pared de acento con listones de madera detrás de la mesa */}
      {atras ? (
        <group position={[cx, 0, zFondo]}>
          <mesh position-y={1.6}>
            <boxGeometry args={[8.2, 3.2, 0.02]} />
            <meshStandardMaterial color={acento} />
          </mesh>
          {Array.from({ length: 13 }, (_, i) => -1.8 + i * 0.3).map((x) => (
            <mesh key={x} position={[x, 1.55, 0.04]}>
              <boxGeometry args={[0.16, 2.9, 0.06]} />
              <meshStandardMaterial color={NOGAL} />
            </mesh>
          ))}
          <Cuadro position={[-3, 1.9, 0.05]} color={tema} />
        </group>
      ) : (
        <group position={[s.x[1] - 0.15, 0, (s.z[0] + s.z[1]) / 2]} rotation-y={-Math.PI / 2}>
          <mesh position-y={1.3}>
            <boxGeometry args={[6.2, 2.6, 0.02]} />
            <meshStandardMaterial color={acento} />
          </mesh>
          <Cuadro position={[-1.4, 1.8, 0.04]} color={tema} />
          <Cuadro position={[-2.7, 1.6, 0.04]} color="#f1c27d" ancho={0.8} alto={1} />
        </group>
      )}

      {/* Alfombra con borde bajo la mesa */}
      <Alfombra position={[cx, 0.02, sz + 0.5]} ancho={4.8} fondo={3.4} color={alfombra} borde={aclarar(tema, 0.75)} />

      {/* Rincón de lectura: butaca, mesita y lámpara de pie */}
      <group position={[cx + 2.9, 0, atras ? -6.1 : 5.9]}>
        <Butaca color={tema} giro={-Math.PI / 2} />
        <mesh position={[0, 0.55, atras ? -1.15 : 1.15]} castShadow>
          <cylinderGeometry args={[0.35, 0.35, 0.05, 20]} />
          <meshStandardMaterial color={NOGAL} />
        </mesh>
        <mesh position={[0, 0.28, atras ? -1.15 : 1.15]}>
          <cylinderGeometry args={[0.04, 0.04, 0.55, 8]} />
          <meshStandardMaterial color={NEGRO_MATE} />
        </mesh>
        <LamparaPie position={[0.8, 0, atras ? 0.7 : -0.7]} />
      </group>

      {/* Estantería con libros y adornos */}
      {atras ? (
        <Estanteria position={[cx + 2.7, 0, s.z[0] + 0.55]} giro={0} />
      ) : (
        <Estanteria position={[s.x[1] - 0.45, 0, 9.3]} giro={-Math.PI / 2} />
      )}

      {/* Planta grande en la esquina */}
      <PlantaGrande position={[cx - 3.5, 0, atras ? s.z[0] + 0.8 : s.z[1] - 0.8]} />

      {/* Cartel con el nombre del dueño y los colores de sus cuentas */}
      <Cartel
        x={cx}
        z={s.puerta[1]}
        texto={dueno ? `Oficina de ${dueno.nombre}` : 'Oficina libre'}
        icono={dueno ? '💼' : '🔑'}
        color={tema}
        puntos={clientes.slice(0, 4).map((c) => c.color)}
      />
    </group>
  )
}

// ---------- Recepción ----------

function Recepcion() {
  const [mx, mz] = RECEPCION.mostrador
  const s = sala('recepcion')
  return (
    <group>
      {/* Mostrador curvo de madera con encimera blanca */}
      <RoundedBox args={[4.4, 1.1, 1.1]} radius={0.3} smoothness={6} position={[mx, 0.55, mz]} castShadow receiveShadow>
        <meshStandardMaterial color={NOGAL} />
      </RoundedBox>
      <RoundedBox args={[4.6, 0.1, 1.3]} radius={0.05} position={[mx, 1.14, mz]} castShadow>
        <meshStandardMaterial color="#f8f9fa" />
      </RoundedBox>
      <mesh position={[mx, 0.62, mz + 0.56]}>
        <boxGeometry args={[3.6, 0.06, 0.02]} />
        <meshStandardMaterial color="#ffc93c" emissive="#ffc93c" emissiveIntensity={0.6} />
      </mesh>
      <Alfombra position={[mx, 0.02, 9.2]} ancho={4} fondo={2.4} color="#b02a37" borde="#f1c27d" />
      <Sofa position={[-15.9, 0, 8.3]} giro={Math.PI / 2} color="#3f7cc2" />
      <PlantaGrande position={[-16.2, 0, 10.3]} />
      <PlantaGrande position={[-9.2, 0, 5.2]} />
      <mesh position={[-9.3, 0.8, 10.3]} castShadow>
        <boxGeometry args={[0.7, 1.6, 0.6]} />
        <meshStandardMaterial color="#c92a2a" />
      </mesh>
      <Cartel x={(s.x[0] + s.x[1]) / 2} z={s.puerta[1]} texto="Recepción" icono="🛎️" color="#f59f00" />
    </group>
  )
}

// ---------- Tu despacho con el tablero de aprobaciones ----------

function Despacho({ pendientes, alClicAprobaciones }: { pendientes: number; alClicAprobaciones: () => void }) {
  const [x, z] = MESA_RAFA
  const s = sala('despacho')
  return (
    <group>
      <Alfombra position={[x, 0.02, 7.8]} ancho={6} fondo={4.2} color="#5c2a2a" borde="#d4a373" />
      {/* Mesa de dirección */}
      <RoundedBox args={[3.4, 0.14, 1.5]} radius={0.06} position={[x, 0.95, z]} castShadow receiveShadow>
        <meshStandardMaterial color={NOGAL} />
      </RoundedBox>
      <RoundedBox args={[3.3, 0.85, 0.1]} radius={0.04} position={[x, 0.45, z - 0.6]} castShadow>
        <meshStandardMaterial color="#5a3a24" />
      </RoundedBox>
      {[-1.5, 1.5].map((lx) => (
        <RoundedBox key={lx} args={[0.12, 0.9, 1.3]} radius={0.03} position={[x + lx, 0.45, z]}>
          <meshStandardMaterial color="#5a3a24" />
        </RoundedBox>
      ))}
      <group position={[x + 0.8, 1.02, z + 0.25]} rotation-y={Math.PI}>
        <mesh position-y={0.42}>
          <boxGeometry args={[1.1, 0.65, 0.05]} />
          <meshStandardMaterial color={NEGRO_MATE} />
        </mesh>
        <mesh position-y={0.1}>
          <cylinderGeometry args={[0.04, 0.12, 0.2, 10]} />
          <meshStandardMaterial color="#868e96" />
        </mesh>
      </group>
      {/* Tu silla de dirección */}
      <group position={[x, 0, z + 1.25]} rotation-y={Math.PI}>
        <SillaOficina color="#1b1f4b" alta />
      </group>
      <TableroAprobaciones pendientes={pendientes} alClic={alClicAprobaciones} />
      {/* Vitrina de trofeos en la pared de la derecha */}
      <group position={[s.x[1] - 0.45, 0, 7.6]} rotation-y={-Math.PI / 2}>
        <RoundedBox args={[2.4, 2, 0.5]} radius={0.05} position-y={1} castShadow>
          <meshStandardMaterial color="#5a3a24" />
        </RoundedBox>
        {[-0.7, 0, 0.7].map((tx, i) => (
          <mesh key={tx} position={[tx, 1.55 - (i % 2) * 0.6, 0.15]}>
            <cylinderGeometry args={[0.12, 0.07, 0.35, 12]} />
            <meshStandardMaterial color="#ffc93c" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
      </group>
      <PlantaGrande position={[s.x[0] + 0.7, 0, 10.3]} />
      <Butaca color="#1b1f4b" giro={Math.PI / 2} position={[s.x[0] + 1, 0, 9.1]} />
      <Cartel x={(s.x[0] + s.x[1]) / 2} z={s.puerta[1]} texto="Despacho de Rafa" icono="👑" color="#ffc93c" />
    </group>
  )
}

function TableroAprobaciones({ pendientes, alClic }: { pendientes: number; alClic: () => void }) {
  const sirena = useRef<THREE.Group>(null)
  const [encima, setEncima] = useState(false)
  const hay = pendientes > 0
  const color = hay ? '#e03131' : '#2f9e44'
  useFrame((_, dt) => {
    if (sirena.current) sirena.current.rotation.y += dt * (hay ? 6 : 0)
  })
  return (
    <group
      position={[MURO_APROBACIONES.x, 0, MURO_APROBACIONES.z]}
      rotation-y={Math.PI / 2}
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
      <RoundedBox args={[3, 1.5, 0.1]} radius={0.08} position-y={1.55} castShadow>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={encima ? 0.7 : 0.3} />
      </RoundedBox>
      <Text font={fuenteJuego} fontSize={0.26} color="white" outlineWidth={0.03} outlineColor="#1b1f4b" position={[0, 1.95, 0.07]}>
        APROBACIONES
      </Text>
      <Text font={fuenteJuego} fontSize={0.5} color="white" outlineWidth={0.04} outlineColor="#1b1f4b" position={[0, 1.4, 0.07]}>
        {hay ? `${pendientes} PENDIENTES` : '¡AL DÍA!'}
      </Text>
      <group position={[1.6, 2.2, 0.1]}>
        <mesh>
          <cylinderGeometry args={[0.16, 0.18, 0.18, 14]} />
          <meshStandardMaterial color="#495057" />
        </mesh>
        <group ref={sirena} position-y={0.16}>
          <mesh>
            <sphereGeometry args={[0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={hay ? '#ff2b2b' : '#5ad15a'} emissive={hay ? '#ff2b2b' : '#5ad15a'} emissiveIntensity={hay ? 1.5 : 0.4} />
          </mesh>
          {hay && <pointLight position={[0, 0.2, 0.4]} color="#ff3b3b" intensity={6} distance={7} />}
        </group>
      </group>
    </group>
  )
}

// ---------- Coworking: cocina, barra, sala de estar, mesa compartida y ping-pong ----------

function Coworking() {
  return (
    <group>
      {/* Cocina: encimera en la pared izquierda */}
      <RoundedBox args={[0.9, 1, 5]} radius={0.06} position={[-16.2, 0.5, -0.2]} castShadow receiveShadow>
        <meshStandardMaterial color="#f1f3f5" />
      </RoundedBox>
      <RoundedBox args={[1, 0.08, 5.1]} radius={0.03} position={[-16.2, 1.04, -0.2]}>
        <meshStandardMaterial color="#343a40" />
      </RoundedBox>
      <RoundedBox args={[0.55, 0.65, 0.5]} radius={0.06} position={[-16.25, 1.4, -1.2]} castShadow>
        <meshStandardMaterial color={NEGRO_MATE} />
      </RoundedBox>
      <mesh position={[-15.97, 1.5, -1.2]}>
        <boxGeometry args={[0.02, 0.08, 0.15]} />
        <meshStandardMaterial color="#ff5a6e" emissive="#ff5a6e" emissiveIntensity={1} />
      </mesh>
      <RoundedBox args={[0.9, 2.2, 0.9]} radius={0.08} position={[-16.2, 1.1, 3.2]} castShadow>
        <meshStandardMaterial color="#dee2e6" metalness={0.3} roughness={0.3} />
      </RoundedBox>
      <Cartel x={-16.68} z={0} giro={Math.PI / 2} texto="Coworking" icono="☕" color="#e8590c" />

      {/* Barra alta con taburetes */}
      <group position={[-12.3, 0, 0]}>
        <mesh position-y={1.1} castShadow>
          <cylinderGeometry args={[0.85, 0.85, 0.07, 28]} />
          <meshStandardMaterial color={NOGAL} />
        </mesh>
        <mesh position-y={0.55}>
          <cylinderGeometry args={[0.07, 0.3, 1.1, 12]} />
          <meshStandardMaterial color={NEGRO_MATE} />
        </mesh>
        {[0.6, 2.7, 4.8].map((a) => (
          <group key={a} position={[Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2]}>
            <mesh position-y={0.8}>
              <cylinderGeometry args={[0.25, 0.25, 0.08, 18]} />
              <meshStandardMaterial color="#e8590c" />
            </mesh>
            <mesh position-y={0.4}>
              <cylinderGeometry args={[0.03, 0.03, 0.8, 8]} />
              <meshStandardMaterial color={NEGRO_MATE} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Sala de estar */}
      <Alfombra position={[-1, 0.025, 0.2]} ancho={7} fondo={4.2} color="#3d5a80" borde="#e0c097" />
      <Sofa position={[-1, 0, -1.55]} giro={0} color="#c9785b" />
      <Butaca color="#e0a96d" giro={Math.PI / 2} position={[-4, 0, 0.8]} />
      <Butaca color="#e0a96d" giro={-Math.PI / 2} position={[2, 0, 0.8]} />
      <RoundedBox args={[1.8, 0.1, 0.9]} radius={0.04} position={[-1, 0.45, 0.4]} castShadow>
        <meshStandardMaterial color={NOGAL} />
      </RoundedBox>
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[-1 + x, 0.2, 0.4]}>
          <boxGeometry args={[0.06, 0.4, 0.7]} />
          <meshStandardMaterial color={NEGRO_MATE} />
        </mesh>
      ))}

      {/* Mesa compartida (para quien no tiene oficina) */}
      <RoundedBox args={[5.2, 0.1, 1.2]} radius={0.04} position={[6.5, 0.92, 0.05]} castShadow receiveShadow>
        <meshStandardMaterial color="#c8a27a" />
      </RoundedBox>
      {[4.1, 8.9].map((x) => (
        <mesh key={x} position={[x, 0.45, 0.05]}>
          <boxGeometry args={[0.08, 0.9, 1]} />
          <meshStandardMaterial color={NEGRO_MATE} />
        </mesh>
      ))}
      {[5, 8].map((x) => (
        <group key={x} position={[x, 0, 1.1]} rotation-y={Math.PI}>
          <SillaOficina color="#495057" />
        </group>
      ))}

      {/* Ping-pong */}
      <group position={[15, 0, 0]}>
        <RoundedBox args={[1.5, 0.08, 2.7]} radius={0.02} position-y={0.76} castShadow>
          <meshStandardMaterial color="#1e6f4f" />
        </RoundedBox>
        <mesh position={[0, 0.81, 0]}>
          <boxGeometry args={[0.03, 0.002, 2.7]} />
          <meshStandardMaterial color="white" />
        </mesh>
        <mesh position={[0, 0.88, 0]}>
          <boxGeometry args={[1.6, 0.14, 0.02]} />
          <meshStandardMaterial color="white" transparent opacity={0.8} />
        </mesh>
        {[-1, 1].map((lz) => (
          <mesh key={lz} position={[0, 0.36, lz * 1]}>
            <boxGeometry args={[1.2, 0.72, 0.06]} />
            <meshStandardMaterial color={NEGRO_MATE} />
          </mesh>
        ))}
      </group>

      {/* Agua y plantas */}
      <group position={[16.4, 0, 3.1]}>
        <RoundedBox args={[0.6, 1.1, 0.6]} radius={0.06} position-y={0.55} castShadow>
          <meshStandardMaterial color="#f1f5f9" />
        </RoundedBox>
        <mesh position-y={1.45}>
          <cylinderGeometry args={[0.26, 0.26, 0.65, 18]} />
          <meshStandardMaterial color="#74c0fc" transparent opacity={0.75} />
        </mesh>
      </group>
      <PlantaGrande position={[-8.2, 0, -2.9]} />
      <PlantaGrande position={[-8.2, 0, 2.9]} />
      <PlantaGrande position={[10.9, 0, -2.9]} />
      <PlantaGrande position={[10.9, 0, 2.9]} />
    </group>
  )
}

// ---------- Mesa de trabajo de un empleado ----------

function Mesa({
  agente,
  puesto,
  clientes,
  tarea,
  resaltada,
  alClic
}: {
  agente: Agente
  puesto: [number, number]
  clientes: Cliente[]
  tarea?: Tarea
  resaltada: boolean
  alClic: () => void
}) {
  const [x, z] = puesto
  const colorPrincipal = clientes[0]?.color ?? agente.color
  const clienteTarea = clientes.find((c) => c.id === tarea?.cliente_id) ?? clientes[0]
  const enCoworking = Math.abs(z) < 2 // la mesa compartida ya existe

  return (
    <group
      position={[x, 0, z]}
      onClick={(e) => {
        e.stopPropagation()
        alClic()
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      {resaltada && (
        <mesh position={[0, 0.05, 0.4]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.55, 1.8, 48]} />
          <meshBasicMaterial color={colorPrincipal} />
        </mesh>
      )}
      <SillaOficina color={agente.color} />
      <group position-z={DIST_MESA}>
        {!enCoworking && (
          <>
            {/* Escritorio de nogal con patas metálicas */}
            <RoundedBox args={[2.5, 0.09, 1.15]} radius={0.04} position-y={0.93} castShadow receiveShadow>
              <meshStandardMaterial color={NOGAL} roughness={0.5} />
            </RoundedBox>
            {[-1.1, 1.1].map((lx) => (
              <group key={lx}>
                {[-0.45, 0.45].map((lz) => (
                  <mesh key={lz} position={[lx, 0.45, lz]}>
                    <cylinderGeometry args={[0.035, 0.035, 0.9, 8]} />
                    <meshStandardMaterial color={NEGRO_MATE} />
                  </mesh>
                ))}
              </group>
            ))}
            {/* Banderines de las cuentas, en el borde delantero */}
            {clientes.slice(0, 5).map((c, i, l) => (
              <group key={c.id} position={[(i - (l.length - 1) / 2) * 0.36, 0.98, 0.5]}>
                <mesh position-y={0.18}>
                  <cylinderGeometry args={[0.01, 0.01, 0.36, 6]} />
                  <meshStandardMaterial color="#adb5bd" />
                </mesh>
                <mesh position={[0.1, 0.3, 0]}>
                  <boxGeometry args={[0.2, 0.13, 0.01]} />
                  <meshStandardMaterial color={c.color} emissive={c.color} emissiveIntensity={0.3} />
                </mesh>
              </group>
            ))}
            {/* Lámpara de mesa */}
            <group position={[-1, 0.98, -0.3]}>
              <mesh position-y={0.02}>
                <cylinderGeometry args={[0.12, 0.12, 0.04, 16]} />
                <meshStandardMaterial color={NEGRO_MATE} />
              </mesh>
              <mesh position={[0.05, 0.25, 0]} rotation-z={-0.3}>
                <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
                <meshStandardMaterial color={NEGRO_MATE} />
              </mesh>
              <mesh position={[0.18, 0.48, 0]} rotation-z={0.9}>
                <coneGeometry args={[0.12, 0.18, 16, 1, true]} />
                <meshStandardMaterial color="#f1c27d" emissive="#ffe8a3" emissiveIntensity={0.6} side={THREE.DoubleSide} />
              </mesh>
            </group>
            {/* Taza y plantita */}
            <mesh position={[0.95, 1.03, 0.25]}>
              <cylinderGeometry args={[0.07, 0.06, 0.13, 14]} />
              <meshStandardMaterial color={agente.color} />
            </mesh>
            <mesh position={[1.05, 1.1, -0.35]}>
              <sphereGeometry args={[0.13, 12, 10]} />
              <meshStandardMaterial color="#4c9a3a" />
            </mesh>
          </>
        )}
        {/* Monitores */}
        {[-0.38, 0.42].map((mx, i) => (
          <group key={mx} position={[mx, 0.98, -0.25]} rotation-y={Math.PI + (i ? -0.22 : 0.22)}>
            <mesh position-y={0.1}>
              <cylinderGeometry args={[0.03, 0.09, 0.2, 10]} />
              <meshStandardMaterial color="#868e96" />
            </mesh>
            <RoundedBox args={[0.78, 0.48, 0.04]} radius={0.015} position-y={0.42} castShadow>
              <meshStandardMaterial color={NEGRO_MATE} />
            </RoundedBox>
            <mesh position={[0, 0.42, 0.022]}>
              <planeGeometry args={[0.72, 0.42]} />
              <meshStandardMaterial
                color={i ? colorPrincipal : '#3fb6ff'}
                emissive={i ? colorPrincipal : '#3fb6ff'}
                emissiveIntensity={agente.estado === 'trabajando' ? 1 : 0.3}
              />
            </mesh>
          </group>
        ))}
        <RoundedBox args={[0.7, 0.03, 0.22]} radius={0.01} position={[0, 0.99, 0.15]}>
          <meshStandardMaterial color="#e9ecef" />
        </RoundedBox>
      </group>

      {agente.estado === 'trabajando' && (
        <PantallaTrabajo>
          <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: clienteTarea?.color ?? '#ffc93c' }}>
            {clienteTarea?.nombre ?? 'Trabajando'}
          </span>
          <span className="max-w-[200px] truncate text-[13px] font-semibold">{tarea?.titulo ?? 'Trabajando…'}</span>
        </PantallaTrabajo>
      )}
    </group>
  )
}

function PantallaTrabajo({ children }: { children: ReactNode }) {
  return (
    // Más pequeño y más alto: así no tapa la vista ni la etiqueta del personaje cuando la cámara se acerca
    <Html position={[0, 4.3, 0.6]} center distanceFactor={11} zIndexRange={[25, 0]}>
      <div className="pointer-events-none flex flex-col rounded-2xl bg-barra/90 px-3 py-1.5 whitespace-nowrap text-white shadow-[0_6px_18px_rgb(16_24_40/0.3)] backdrop-blur">
        <span className="text-[10px] font-semibold tracking-wider text-lima uppercase">Trabajando en</span>
        {children}
      </div>
    </Html>
  )
}

// ---------- Muebles con formas suaves ----------

function SillaOficina({ color, alta = false }: { color: string; alta?: boolean }) {
  return (
    <group>
      <RoundedBox args={[0.85, 0.14, 0.82]} radius={0.06} position-y={0.56} castShadow>
        <meshStandardMaterial color={color} />
      </RoundedBox>
      <RoundedBox args={[0.82, alta ? 1.3 : 0.95, 0.12]} radius={0.06} position={[0, alta ? 1.25 : 1.08, -0.42]} rotation-x={-0.08} castShadow>
        <meshStandardMaterial color={color} />
      </RoundedBox>
      <mesh position-y={0.3}>
        <cylinderGeometry args={[0.05, 0.05, 0.5, 10]} />
        <meshStandardMaterial color="#868e96" metalness={0.6} roughness={0.3} />
      </mesh>
      {[0, 1.26, 2.51, 3.77, 5.03].map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.26, 0.06, Math.sin(a) * 0.26]} rotation-y={-a}>
          <boxGeometry args={[0.5, 0.04, 0.06]} />
          <meshStandardMaterial color={NEGRO_MATE} />
        </mesh>
      ))}
    </group>
  )
}

function Butaca({ color, giro, position = [0, 0, 0] }: { color: string; giro: number; position?: V3 }) {
  return (
    <group position={position} rotation-y={giro}>
      <RoundedBox args={[1.1, 0.42, 1]} radius={0.16} smoothness={5} position-y={0.42} castShadow>
        <meshStandardMaterial color={color} roughness={0.85} />
      </RoundedBox>
      <RoundedBox args={[1.1, 0.75, 0.26]} radius={0.12} smoothness={5} position={[0, 0.8, -0.38]} castShadow>
        <meshStandardMaterial color={color} roughness={0.85} />
      </RoundedBox>
      {[-0.5, 0.5].map((x) => (
        <RoundedBox key={x} args={[0.2, 0.55, 0.95]} radius={0.09} position={[x, 0.62, 0]}>
          <meshStandardMaterial color={color} roughness={0.85} />
        </RoundedBox>
      ))}
      {[-0.42, 0.42].map((x) =>
        [-0.36, 0.36].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.1, z]}>
            <cylinderGeometry args={[0.03, 0.02, 0.2, 6]} />
            <meshStandardMaterial color={NOGAL} />
          </mesh>
        ))
      )}
    </group>
  )
}

function Sofa({ position, giro, color }: { position: V3; giro: number; color: string }) {
  return (
    <group position={position} rotation-y={giro}>
      <RoundedBox args={[2.9, 0.42, 1.05]} radius={0.16} smoothness={5} position-y={0.42} castShadow>
        <meshStandardMaterial color={color} roughness={0.85} />
      </RoundedBox>
      <RoundedBox args={[2.9, 0.75, 0.3]} radius={0.13} smoothness={5} position={[0, 0.8, -0.4]} castShadow>
        <meshStandardMaterial color={color} roughness={0.85} />
      </RoundedBox>
      {[-1.35, 1.35].map((x) => (
        <RoundedBox key={x} args={[0.24, 0.6, 1.05]} radius={0.1} position={[x, 0.6, 0]}>
          <meshStandardMaterial color={color} roughness={0.85} />
        </RoundedBox>
      ))}
      {[-0.7, 0.7].map((x) => (
        <RoundedBox key={x} args={[0.6, 0.45, 0.14]} radius={0.06} position={[x, 0.85, -0.18]} rotation-x={-0.2}>
          <meshStandardMaterial color={aclarar(color, 0.35)} />
        </RoundedBox>
      ))}
    </group>
  )
}

function Alfombra({ position, ancho, fondo, color, borde }: { position: V3; ancho: number; fondo: number; color: string; borde: string }) {
  return (
    <group position={position}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ancho, fondo]} />
        <meshStandardMaterial color={borde} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} receiveShadow>
        <planeGeometry args={[ancho - 0.3, fondo - 0.3]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.008}>
        <ringGeometry args={[Math.min(ancho, fondo) * 0.22, Math.min(ancho, fondo) * 0.26, 40]} />
        <meshStandardMaterial color={borde} roughness={1} />
      </mesh>
    </group>
  )
}

function LamparaPie({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <mesh position-y={0.02}>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 18]} />
        <meshStandardMaterial color={NEGRO_MATE} />
      </mesh>
      <mesh position-y={0.85}>
        <cylinderGeometry args={[0.025, 0.025, 1.7, 8]} />
        <meshStandardMaterial color={NEGRO_MATE} />
      </mesh>
      <mesh position-y={1.75}>
        <cylinderGeometry args={[0.2, 0.3, 0.35, 20, 1, true]} />
        <meshStandardMaterial color="#f8f1e5" emissive="#ffe8a3" emissiveIntensity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function PlantaGrande({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <mesh position-y={0.3} castShadow>
        <cylinderGeometry args={[0.32, 0.26, 0.6, 20]} />
        <meshStandardMaterial color="#f1ebe1" roughness={0.6} />
      </mesh>
      <mesh position-y={0.9}>
        <cylinderGeometry args={[0.03, 0.04, 1, 6]} />
        <meshStandardMaterial color="#6b4423" />
      </mesh>
      {[
        [0, 1.6, 0, 0.42],
        [0.3, 1.3, 0.15, 0.32],
        [-0.28, 1.4, -0.1, 0.34],
        [0.1, 1.95, -0.1, 0.3],
        [-0.15, 1.1, 0.25, 0.28]
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[1, 0.8, 1]} castShadow>
          <sphereGeometry args={[r, 14, 10]} />
          <meshStandardMaterial color={['#3d8b37', '#4fa846', '#2f7a2e', '#5cb85c', '#3d8b37'][i]} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function Estanteria({ position, giro }: { position: V3; giro: number }) {
  const libros = ['#c0392b', '#2c3e50', '#d4a373', '#4a6741', '#7b5ea7', '#e0a96d']
  return (
    <group position={position} rotation-y={giro}>
      {/* Estructura abierta */}
      {[0.05, 0.75, 1.45, 2.15].map((y) => (
        <RoundedBox key={y} args={[1.9, 0.06, 0.42]} radius={0.02} position-y={y}>
          <meshStandardMaterial color={NOGAL} />
        </RoundedBox>
      ))}
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} position={[x, 1.1, 0]}>
          <boxGeometry args={[0.05, 2.2, 0.42]} />
          <meshStandardMaterial color={NEGRO_MATE} />
        </mesh>
      ))}
      {[0.08, 0.78, 1.48].map((y, f) => (
        <group key={y} position-y={y}>
          {libros.slice(0, 4 + (f % 2)).map((c, i) => (
            <mesh key={i} position={[-0.75 + i * 0.16, 0.24 - ((i + f) % 3) * 0.03, 0]} rotation-z={i === 3 + (f % 2) ? 0.25 : 0}>
              <boxGeometry args={[0.13, 0.48 - ((i + f) % 3) * 0.06, 0.3]} />
              <meshStandardMaterial color={c} />
            </mesh>
          ))}
          {/* Adorno: jarrón o esfera */}
          {f % 2 ? (
            <mesh position={[0.55, 0.2, 0]}>
              <sphereGeometry args={[0.16, 16, 12]} />
              <meshStandardMaterial color="#d4a373" metalness={0.5} roughness={0.3} />
            </mesh>
          ) : (
            <mesh position={[0.55, 0.22, 0]}>
              <cylinderGeometry args={[0.1, 0.14, 0.4, 16]} />
              <meshStandardMaterial color="#f1ebe1" />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

function Cuadro({ position, color, ancho = 1.3, alto = 0.9 }: { position: V3; color: string; ancho?: number; alto?: number }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[ancho, alto, 0.04]} />
        <meshStandardMaterial color="#1f1f1f" />
      </mesh>
      <mesh position-z={0.022}>
        <planeGeometry args={[ancho - 0.12, alto - 0.12]} />
        <meshStandardMaterial color="#faf6ef" />
      </mesh>
      {/* Arte abstracto */}
      <mesh position={[-ancho * 0.12, -alto * 0.08, 0.025]}>
        <circleGeometry args={[Math.min(ancho, alto) * 0.22, 24]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[ancho * 0.15, alto * 0.1, 0.026]}>
        <planeGeometry args={[ancho * 0.25, alto * 0.45]} />
        <meshStandardMaterial color="#2c3e50" />
      </mesh>
    </group>
  )
}
