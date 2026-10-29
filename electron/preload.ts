import { contextBridge, ipcRenderer } from 'electron'

// EL PUENTE: lo único que la pantalla puede pedirle al cerebro.
const api = {
  infoSistema: (): Promise<{ plataforma: string; version: string }> => ipcRenderer.invoke('sistema:info'),
  recepcion: {
    // Envía un encargo a la recepcionista. El token es la sesión de Rafa en Supabase.
    enviar: (texto: string, token: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('recepcion:enviar', texto, token)
  },
  agentes: {
    // Pide a un empleado que trabaje una tarea pendiente
    trabajar: (tareaId: string, agenteId: string, token: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('agentes:trabajar', tareaId, agenteId, token),
    // Retoma revisiones y tareas que se quedaron a medias porque la app se cerró
    rescatar: (token: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('agentes:rescatar', token),
    // Le escribes a un empleado en su chat; su respuesta llega como mensaje nuevo
    charlar: (agenteId: string, texto: string, token: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('agentes:charlar', agenteId, texto, token)
  },
  aprobaciones: {
    // Tu decisión en la bandeja; si apruebas, el ejecutor la lleva a cabo
    decidir: (id: string, decision: 'aprobada' | 'rechazada', comentario: string, token: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('aprobaciones:decidir', id, decision, comentario, token)
  },
  google: {
    // ¿Está conectada tu cuenta de Google? (nunca devuelve tokens, solo el correo)
    estado: (): Promise<{ configurado: boolean; conectado: boolean; correo: string | null; faltaGmail: boolean }> => ipcRenderer.invoke('google:estado'),
    // Abre el navegador para que des permiso a Drive y Calendar
    conectar: (): Promise<{ ok: boolean; correo?: string; error?: string }> => ipcRenderer.invoke('google:conectar'),
    desconectar: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('google:desconectar')
  }
}

export type DrafsoyApi = typeof api

contextBridge.exposeInMainWorld('drafsoy', api)
