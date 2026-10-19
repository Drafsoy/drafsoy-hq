import { Suspense, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import { agentesDeCliente, clientesDeAgente, usarDatos } from '@/datos/DatosProvider'
import type { Cliente, Tarea } from '@/datos/tipos'
import { usarRuta, type Ruta } from '@/navegacion'
import Isla from './Isla'
import Oficina, { fuenteJuego } from './Oficina'
import Autobus from './Autobus'
import Ciudad from './Ciudad'
import { Cofre, Paracaidas } from './Efectos'
import { DIST_MESA, MURO_APROBACIONES, RECEPCION, Z_OFICINA, enMundo, puestoDe } from './medidas'
import { configureTextBuilder } from 'troika-three-text'
import { posicionesAgentes } from './seguimiento'

// Los letreros 3D se generan en el hilo principal: la seguridad de la app bloquea los "workers".
configureTextBuilder({ useWorker: false, defaultFontURL: fuenteJuego })

interface Caida {
  id: string
  destino: [number, number, number]
  color: string
}
interface CofreActivo {
  id: string
  posicion: [number, number, number]
}

export default function Escena() {
  const datos = usarDatos()
  const { clientes, agentes, tareas, aprobaciones, cargando } = datos
  const { ruta, ir } = usarRuta()
  const [caidas, setCaidas] = useState<Caida[]>([])
  const [cofres, setCofres] = useState<CofreActivo[]>([])
  const [bailando, setBailando] = useState<Set<string>>(new Set())
  const vistas = useRef<Map<string, string> | null>(null)

  // Detecta tareas nuevas (paracaídas sobre la mesa) y completadas (cofre + baile).
  useEffect(() => {
    if (cargando) return
    if (!vistas.current) {
      vistas.current = new Map(tareas.map((t) => [t.id, t.estado]))
      return
    }
    for (const t of tareas) {
      const antes = vistas.current.get(t.id)
      vistas.current.set(t.id, t.estado)
      const agente = agentes.find((a) => a.id === t.agente_id)
      const [px, pz] = agente ? puestoDe(agente, agentes) : RECEPCION.mostrador
      const color = clientes.find((c) => c.id === t.cliente_id)?.color ?? '#ffc93c'

      if (antes === undefined) {
        // Cae sobre la mesa del empleado (o en recepción si no tiene a nadie asignado)
        const destino = agente ? enMundo(px, pz + DIST_MESA, 1) : enMundo(px, pz, 1.25)
        setCaidas((c) => [...c, { id: t.id, destino, color }])
      }

      if (antes !== undefined && antes !== 'completada' && t.estado === 'completada') {
        setCofres((c) => [...c, { id: `${t.id}-${Date.now()}`, posicion: enMundo(px - 1.9, pz + 2.1) }])
        if (agente) {
          setBailando((s) => new Set(s).add(agente.id))
          setTimeout(() => {
            setBailando((s) => {
              const nuevo = new Set(s)
              nuevo.delete(agente.id)
              return nuevo
            })
          }, 5000)
        }
      }
    }
  }, [tareas, cargando, agentes, clientes])

  // Cuentas de cada empleado y la tarea en la que está trabajando
  const clientesPorAgente = useMemo(() => {
    const mapa: Record<string, Cliente[]> = {}
    for (const a of agentes) mapa[a.id] = clientesDeAgente(datos, a.id)
    return mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentes, datos.clientes, datos.asignaciones])

  const tareaActual = useMemo(() => {
    const mapa: Record<string, Tarea | undefined> = {}
    for (const t of tareas) if (t.agente_id && t.estado === 'en_progreso') mapa[t.agente_id] = t
    return mapa
  }, [tareas])

  // Al abrir un cliente se iluminan las mesas de quienes llevan su cuenta
  const resaltados = useMemo(
    () => new Set(ruta.pantalla === 'cliente' ? agentesDeCliente(datos, ruta.id).map((a) => a.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ruta, datos.asignaciones, agentes]
  )

  const pendientes = aprobaciones.filter((a) => a.estado === 'pendiente').length

  return (
    <Canvas shadows="percentage" flat dpr={[1, 2]} camera={{ position: [8, 40, 29], fov: 45, near: 0.5, far: 1500 }}>
      <Cielo />
      <fog attach="fog" args={['#bfe8ff', 140, 420]} />
      <hemisphereLight args={['#cfeeff', '#62d23a', 1.1]} />
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[35, 70, 30]}
        intensity={2.3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-far={220}
        shadow-bias={-0.0005}
      />

      <Isla />
      <Ciudad />
      <Suspense fallback={null}>
        <Oficina
          agentes={agentes}
          clientesPorAgente={clientesPorAgente}
          tareaActual={tareaActual}
          pendientes={pendientes}
          bailando={bailando}
          resaltados={resaltados}
          alClicAgente={(a) => ir({ pantalla: 'agente', id: a.id })}
          alClicAprobaciones={() => ir({ pantalla: 'bandeja' })}
        />
      </Suspense>
      <Autobus />

      {caidas.map((c) => (
        <Paracaidas key={c.id} destino={c.destino} color={c.color} alTerminar={() => setCaidas((l) => l.filter((x) => x.id !== c.id))} />
      ))}
      {cofres.map((c) => (
        <Cofre key={c.id} posicion={c.posicion} alAbrir={() => setCofres((l) => l.filter((x) => x.id !== c.id))} />
      ))}

      <Camara ruta={ruta} />
    </Canvas>
  )
}

// La cámara vuela suavemente a donde estás mirando en la app.
function Camara({ ruta }: { ruta: Ruta }) {
  const ref = useRef<ComponentRef<typeof CameraControls>>(null)
  const { agentes } = usarDatos()

  const objetivo = useMemo(() => {
    // Vista general: la oficina sin techo desde arriba, centrada en el hueco que deja la barra lateral
    const general = { pos: [8, 40, Z_OFICINA + 34], mira: [-2, 0, Z_OFICINA + 1] }
    // Con un panel abierto a la derecha, el objetivo se desplaza para que quede a la izquierda
    const verPunto = (x: number, z: number, cerca = 13) => ({ pos: [x + 5, cerca * 0.8, z + Z_OFICINA + cerca], mira: [x + 5, 1, z + Z_OFICINA] })

    switch (ruta.pantalla) {
      case 'agente': {
        const agente = agentes.find((a) => a.id === ruta.id)
        if (!agente) return general
        const [x, z] = puestoDe(agente, agentes)
        // Más desde arriba, para mirar por encima de la cristalera y los carteles
        return { pos: [x + 3, 10, z + Z_OFICINA + 8.5], mira: [x + 3, 1.2, z + Z_OFICINA] }
      }
      case 'cliente':
        return { pos: [12, 34, Z_OFICINA + 30], mira: [8, 0, Z_OFICINA] }
      case 'bandeja':
        return verPunto(MURO_APROBACIONES.x, MURO_APROBACIONES.z + 3, 12)
      case 'chat':
        return verPunto(RECEPCION.puesto[0], RECEPCION.puesto[1], 12)
      default:
        return general
    }
  }, [ruta, agentes])

  const clave = JSON.stringify(objetivo)
  useEffect(() => {
    const [px, py, pz] = objetivo.pos
    const [mx, my, mz] = objetivo.mira
    ref.current?.setLookAt(px, py, pz, mx, my, mz, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  // Con un agente seleccionado, la cámara lo sigue mientras camina (el zoom y el giro son alrededor de él)
  useFrame(() => {
    if (ruta.pantalla !== 'agente' || !ref.current) return
    const p = posicionesAgentes.get(ruta.id)
    if (p) ref.current.moveTo(p.x + 3, p.y + 1.2, p.z, true)
  })

  // dollyToCursor: la rueda del ratón acerca la cámara hacia donde apuntas, no al centro
  return (
    <CameraControls
      ref={ref}
      makeDefault
      dollyToCursor
      minDistance={4}
      maxDistance={180}
      maxPolarAngle={Math.PI / 2.08}
      smoothTime={0.5}
    />
  )
}
// Cielo azul degradado, estilo cartoon.
function Cielo() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          arriba: { value: new THREE.Color('#2f7fe8') },
          abajo: { value: new THREE.Color('#b8e2ff') }
        },
        vertexShader: /* glsl */ `
          varying vec3 vPos;
          void main() {
            vPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 arriba;
          uniform vec3 abajo;
          varying vec3 vPos;
          void main() {
            float h = clamp(normalize(vPos).y * 1.8 + 0.05, 0.0, 1.0);
            gl_FragColor = vec4(mix(abajo, arriba, h), 1.0);
            #include <colorspace_fragment>
          }`
      }),
    []
  )
  return (
    <mesh material={material} renderOrder={-1}>
      <sphereGeometry args={[900, 32, 16]} />
    </mesh>
  )
}
