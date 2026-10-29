import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import './config'
import { atenderMensaje } from './agentes/recepcionista'
import { charlarConEmpleado } from './agentes/charla'
import { trabajarTarea } from './agentes/empleado'
import { decidirAprobacion } from './agentes/ejecutor'
import { rescatarHuerfanas } from './agentes/supervisor'
import { crearDb } from './agentes/comun'
import { conectarGoogle, desconectarGoogle, estadoGoogle } from './google'

// Cada empleado trabaja una tarea a la vez (las demás esperan en su cola)
const colas = new Map<string, Promise<void>>()
const enCurso = new Set<string>()

// EL CEREBRO: aquí vivirán los agentes y la llave de Anthropic.
// La pantalla nunca ve la llave; solo pide cosas a través del puente (preload).

function crearVentana(): void {
  const ventana = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Drafsoy HQ',
    backgroundColor: '#1b1f4b',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  ventana.once('ready-to-show', () => ventana.show())

  // Solo desarrollo: guarda capturas de la ventana para revisar el diseño.
  const rutaCaptura = process.env.DRAFSOY_CAPTURA
  if (rutaCaptura && !app.isPackaged) {
    let n = 0
    const intervalo = setInterval(async () => {
      n++
      // Tras la primera captura, puede abrir la ficha de un agente concreto
      if (n === 2 && process.env.DRAFSOY_CAPTURA_AGENTE) {
        await ventana.webContents.executeJavaScript(`window.__verAgente && window.__verAgente(${JSON.stringify(process.env.DRAFSOY_CAPTURA_AGENTE)})`)
        await new Promise((r) => setTimeout(r, 2500))
      }
      // O una pantalla concreta para la 3ª captura, p. ej. {"pantalla":"bandeja"}
      if (n === 3 && process.env.DRAFSOY_CAPTURA_RUTA) {
        await ventana.webContents.executeJavaScript(`window.__ir && window.__ir(${process.env.DRAFSOY_CAPTURA_RUTA})`)
        await new Promise((r) => setTimeout(r, 2500))
      }
      const imagen = await ventana.webContents.capturePage()
      writeFileSync(rutaCaptura.replace('.png', `-${n}.png`), imagen.toPNG())
      if (n >= 3) clearInterval(intervalo)
    }, 9000)
  }

  // Los enlaces externos se abren en el navegador, no dentro de la app.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    ventana.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    ventana.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('sistema:info', () => ({
  plataforma: process.platform,
  version: app.getVersion()
}))

// La pantalla le pasa a la recepcionista el mensaje de Rafa y su sesión (para respetar la seguridad de la base de datos)
ipcMain.handle('recepcion:enviar', async (_evento, texto: unknown, token: unknown) => {
  if (typeof texto !== 'string' || !texto.trim() || texto.length > 8000) return { ok: false, error: 'Mensaje vacío o demasiado largo.' }
  if (typeof token !== 'string' || !token) return { ok: false, error: 'Sesión no válida.' }
  try {
    await atenderMensaje(texto.trim(), token)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
})

// Rafa habla directamente con un empleado en su chat
ipcMain.handle('agentes:charlar', async (_evento, agenteId: unknown, texto: unknown, token: unknown) => {
  if (typeof agenteId !== 'string' || typeof texto !== 'string' || !texto.trim() || texto.length > 8000) return { ok: false, error: 'Mensaje vacío o demasiado largo.' }
  if (typeof token !== 'string' || !token) return { ok: false, error: 'Sesión no válida.' }
  try {
    await charlarConEmpleado(agenteId, texto.trim(), token)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
})

// Un empleado empieza a trabajar una tarea (la pantalla lo pide cuando hay tareas pendientes asignadas)
// Si piden una tarea que aún está en curso (p. ej. el supervisor la devolvió mientras terminaba su revisión),
// se apunta y se vuelve a lanzar en cuanto acabe, en vez de perder el aviso.
const repetir = new Map<string, string>() // tareaId -> token más reciente

function encolarTarea(tareaId: string, agenteId: string, token: string) {
  if (enCurso.has(tareaId)) {
    repetir.set(tareaId, token)
    return
  }
  enCurso.add(tareaId)
  const anterior = colas.get(agenteId) ?? Promise.resolve()
  const turno = anterior
    .then(() => trabajarTarea(tareaId, token))
    .catch((e) => console.error('[empleado]', e))
    .finally(() => {
      enCurso.delete(tareaId)
      const tokenNuevo = repetir.get(tareaId)
      if (tokenNuevo) {
        repetir.delete(tareaId)
        // trabajarTarea solo la coge si sigue "pendiente", así que repetir es seguro
        encolarTarea(tareaId, agenteId, tokenNuevo)
      }
    })
  colas.set(agenteId, turno)
}

ipcMain.handle('agentes:trabajar', async (_evento, tareaId: unknown, agenteId: unknown, token: unknown) => {
  if (typeof tareaId !== 'string' || typeof agenteId !== 'string' || typeof token !== 'string') return { ok: false }
  encolarTarea(tareaId, agenteId, token)
  return { ok: true }
})

// Retoma lo que un cierre de la app dejó a medias (revisiones y tareas "en progreso" huérfanas).
// La pantalla lo pide al arrancar con la sesión de Rafa; si ya hay un rescate en marcha, no se repite.
let rescateEnMarcha = false
ipcMain.handle('agentes:rescatar', async (_evento, token: unknown) => {
  if (typeof token !== 'string' || !token) return { ok: false }
  if (rescateEnMarcha) return { ok: true }
  rescateEnMarcha = true
  rescatarHuerfanas(crearDb(token), enCurso)
    .catch((e) => console.error('[rescate]', e))
    .finally(() => (rescateEnMarcha = false))
  return { ok: true }
})

// Rafa aprueba o rechaza en la bandeja; solo entonces el ejecutor actúa
ipcMain.handle('aprobaciones:decidir', async (_evento, id: unknown, decision: unknown, comentario: unknown, token: unknown) => {
  if (typeof id !== 'string' || (decision !== 'aprobada' && decision !== 'rechazada') || typeof token !== 'string') return { ok: false, error: 'Datos no válidos.' }
  try {
    await decidirAprobacion(id, decision, typeof comentario === 'string' ? comentario.slice(0, 2000) : '', token)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
})

// Google: la pantalla solo pide conectar/desconectar; los tokens nunca salen del cerebro
ipcMain.handle('google:estado', () => estadoGoogle())
ipcMain.handle('google:conectar', async () => {
  try {
    const { correo } = await conectarGoogle()
    return { ok: true, correo }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
})
ipcMain.handle('google:desconectar', async () => {
  await desconectarGoogle()
  return { ok: true }
})

app.whenReady().then(() => {
  crearVentana()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
