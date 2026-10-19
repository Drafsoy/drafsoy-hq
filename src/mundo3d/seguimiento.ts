import type * as THREE from 'three'

// Posición en el mundo de cada personaje (la actualiza cada minifigura en cada fotograma).
// La cámara la usa para seguir al agente seleccionado.
export const posicionesAgentes = new Map<string, THREE.Vector3>()
