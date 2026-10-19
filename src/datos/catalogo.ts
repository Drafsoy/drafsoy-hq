// Opciones fijas que usan los formularios de agentes.

export const HERRAMIENTAS = [
  { id: 'redactar', texto: 'Redactar textos y copies' },
  { id: 'analizar', texto: 'Analizar datos y resultados' },
  { id: 'memoria_cliente', texto: 'Leer y guardar memoria del cliente' },
  { id: 'proponer_accion', texto: 'Proponer acciones externas (van a la bandeja)' },
  { id: 'crear_tarea', texto: 'Crear tareas' },
  { id: 'asignar_tarea', texto: 'Asignar tareas a otros agentes' },
  { id: 'consultar_agenda', texto: 'Consultar la agenda' }
] as const

// Acciones que tocan el mundo exterior. SIEMPRE pasan por tu aprobación.
export const ACCIONES_EXTERNAS = [
  { id: 'enviar', texto: 'Enviar correo (Gmail)' },
  { id: 'publicar', texto: 'Publicar' },
  { id: 'pausar', texto: 'Pausar campañas o anuncios' },
  { id: 'cambiar_presupuesto', texto: 'Cambiar presupuesto' },
  { id: 'subir_archivo', texto: 'Subir documento a Google Drive' },
  { id: 'agendar_reunion', texto: 'Agendar reunión en Google Calendar' }
] as const

export const MODELOS = [
  { id: 'claude-haiku-5-5', texto: 'Haiku 5.5 · rápido y barato' },
  { id: 'claude-sonnet-5-5', texto: 'Sonnet 5.5 · equilibrado' },
  { id: 'claude-opus-5-5', texto: 'Opus 5.5 · el más potente' }
] as const

// Plantillas de rol para contratar empleados nuevos (se pueden editar después en su ficha)
export const PLANTILLAS_ROL = [
  {
    id: 'trafficker',
    rol: 'Trafficker',
    icono: '📊',
    color: '#1c7ed6',
    herramientas: ['redactar', 'analizar', 'memoria_cliente', 'proponer_accion'],
    instrucciones:
      'Trafficker digital de la agencia. Planificas, lanzas y optimizas campañas de pago (Meta, Google, TikTok) para las cuentas que llevas. Propones estructuras de campaña, segmentaciones, presupuestos y copies, y explicas cada recomendación con datos.'
  },
  {
    id: 'community',
    rol: 'Community manager',
    icono: '📱',
    color: '#d6336c',
    herramientas: ['redactar', 'memoria_cliente', 'proponer_accion'],
    instrucciones:
      'Community manager de la agencia. Creas calendarios de contenido, publicaciones y respuestas para redes sociales con el tono de cada cliente. Toda publicación o respuesta pública se propone para aprobación.'
  },
  {
    id: 'copy',
    rol: 'Copywriter',
    icono: '✍️',
    color: '#f59f00',
    herramientas: ['redactar', 'memoria_cliente'],
    instrucciones:
      'Copywriter de la agencia. Escribes textos persuasivos para anuncios, landings y correos: varios ángulos por encargo, con titular, texto y llamada a la acción, respetando el tono y las prohibiciones de cada cliente.'
  },
  {
    id: 'diseno',
    rol: 'Diseñador',
    icono: '🎨',
    color: '#7048e8',
    herramientas: ['redactar', 'memoria_cliente', 'proponer_accion'],
    instrucciones:
      'Diseñador de la agencia. Preparas briefs creativos detallados (concepto, composición, texto en imagen, formatos por plataforma) y propones las piezas para revisión.'
  },
  {
    id: 'analista',
    rol: 'Analista de datos',
    icono: '📈',
    color: '#2f9e44',
    herramientas: ['analizar', 'redactar', 'memoria_cliente'],
    instrucciones:
      'Analista de datos de la agencia. Preparas reportes de resultados, detectas qué funciona y qué no, y das recomendaciones accionables. Nunca inventas cifras: si faltan datos, lo dices y explicas cómo obtenerlos.'
  },
  {
    id: 'estratega',
    rol: 'Estratega',
    icono: '🎯',
    color: '#e03131',
    herramientas: ['redactar', 'analizar', 'memoria_cliente'],
    instrucciones:
      'Estratega de la agencia. Defines planes de campaña: objetivos, público, mensajes, embudo, presupuesto por fase y calendario, alineados con el negocio de cada cliente.'
  }
] as const
