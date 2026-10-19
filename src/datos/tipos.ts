// Formas de los datos, iguales a las tablas de supabase/migraciones (001 + 003_agencia)

export type EstadoAgente = 'disponible' | 'trabajando' | 'te_necesita' | 'esperando_aprobacion'
export type EstadoTarea = 'pendiente' | 'en_progreso' | 'te_necesita' | 'esperando_aprobacion' | 'completada' | 'cancelada'
export type Prioridad = 'baja' | 'media' | 'alta' | 'urgente'
export type EstadoAprobacion = 'en_revision' | 'pendiente' | 'aprobada' | 'rechazada' | 'ejecutada' | 'fallida'

// Un cliente es una cuenta de la agencia
export interface Cliente {
  id: string
  nombre: string
  color: string
  descripcion: string | null
  activo: boolean
  creado_en: string
}

// Qué cuentas lleva cada empleado
export interface AgenteCliente {
  id: string
  agente_id: string
  cliente_id: string
  creado_en: string
}

export interface Agente {
  id: string
  nombre: string
  skin_avatar: string | null
  skin_modelo: string | null
  color: string
  rol: string
  instrucciones: string
  herramientas: string[]
  modelo: string
  acciones_con_aprobacion: string[]
  tareas_recurrentes: unknown[]
  tope_gasto_usd: number
  estado: EstadoAgente
  es_recepcionista: boolean
  es_supervisor: boolean
  creado_en: string
}

export interface Tarea {
  id: string
  titulo: string
  descripcion: string | null
  tipo: string | null
  estado: EstadoTarea
  prioridad: Prioridad
  cliente_id: string | null
  agente_id: string | null
  fecha_limite: string | null
  resultado: string | null
  revision: string | null
  intentos: number
  creado_en: string
  actualizado_en: string
}

export interface Aprobacion {
  id: string
  tarea_id: string | null
  agente_id: string | null
  cliente_id: string | null
  tipo_accion: string
  titulo: string
  detalle: Record<string, unknown>
  estado: EstadoAprobacion
  comentario: string | null
  nota_supervisor: string | null
  resultado: Record<string, unknown> | null
  creado_en: string
  resuelto_en: string | null
}

export const ESTADOS_AGENTE: Record<EstadoAgente, { texto: string; color: string }> = {
  disponible: { texto: 'Disponible', color: '#4ade5a' },
  trabajando: { texto: 'Trabajando', color: '#3fa9ff' },
  te_necesita: { texto: 'Te necesita', color: '#ff5a6e' },
  esperando_aprobacion: { texto: 'Esperando aprobación', color: '#ffc93c' }
}

export interface Mensaje {
  id: string
  canal: string
  rol: 'usuario' | 'asistente' | 'sistema'
  contenido: string
  tarea_id: string | null
  creado_en: string
}

export interface MemoriaCliente {
  id: string
  cliente_id: string
  clave: string
  contenido: string
  creado_en: string
  actualizado_en: string
}

export interface Gasto {
  id: string
  agente_id: string | null
  tarea_id: string | null
  modelo: string
  tokens_entrada: number
  tokens_salida: number
  costo_usd: number
  creado_en: string
}

export interface Ajustes {
  dueno: string
  tope_mensual_usd: number
  modelo_recepcion: string
  modelo_agentes: string
  trabajo_automatico: boolean
  actualizado_en: string
}

export const TAREA_ABIERTA = (t: Tarea) => t.estado !== 'completada' && t.estado !== 'cancelada'

export const ESTADOS_TAREA: Record<EstadoTarea, { texto: string; color: string }> = {
  pendiente: { texto: 'Pendiente', color: '#cbd5e1' },
  en_progreso: { texto: 'En progreso', color: '#3fa9ff' },
  te_necesita: { texto: 'Te necesita', color: '#ff5a6e' },
  esperando_aprobacion: { texto: 'Esperando aprobación', color: '#ffc93c' },
  completada: { texto: 'Completada', color: '#4ade5a' },
  cancelada: { texto: 'Cancelada', color: '#64748b' }
}

export const PRIORIDADES: Record<Prioridad, { texto: string; color: string }> = {
  baja: { texto: 'Baja', color: '#94a3b8' },
  media: { texto: 'Media', color: '#3fa9ff' },
  alta: { texto: 'Alta', color: '#ff9f40' },
  urgente: { texto: 'Urgente', color: '#ff5a6e' }
}

export const ESTADOS_APROBACION: Record<EstadoAprobacion, { texto: string; color: string }> = {
  en_revision: { texto: 'En revisión', color: '#a15cff' },
  pendiente: { texto: 'Pendiente', color: '#ffc93c' },
  aprobada: { texto: 'Aprobada', color: '#3fa9ff' },
  rechazada: { texto: 'Rechazada', color: '#ff5a6e' },
  ejecutada: { texto: 'Ejecutada', color: '#4ade5a' },
  fallida: { texto: 'Falló', color: '#ff5a6e' }
}
