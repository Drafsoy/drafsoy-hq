import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { CONFIG } from './config'
import { carpetaTrabajos, listarTrabajos } from './agentes/conectores'

// Publicar un trabajo de carpeta en Netlify. Solo lo llama el ejecutor, después de que Rafa apruebe.
// El sitio y el archivo salen del "drafsoy-trabajo.json" de la carpeta, no de lo que proponga el agente.

interface ConfigPublicar {
  plataforma?: string
  sitio?: string
  archivo?: string
}

export async function publicarEnNetlify(trabajo: string): Promise<{ mensaje: string; enlace: string }> {
  if (!CONFIG.netlifyToken) throw new Error('Falta NETLIFY_AUTH_TOKEN en el archivo .env (la clave de tu cuenta de Netlify).')
  if (!listarTrabajos().includes(trabajo)) throw new Error(`No existe el trabajo "${trabajo}".`)
  const carpeta = join(carpetaTrabajos(), trabajo)

  let conf: ConfigPublicar = {}
  try {
    conf = (JSON.parse(readFileSync(join(carpeta, 'drafsoy-trabajo.json'), 'utf-8')) as { publicar?: ConfigPublicar }).publicar ?? {}
  } catch {
    throw new Error('Este trabajo no tiene configurado dónde publicarse (drafsoy-trabajo.json).')
  }
  if (conf.plataforma !== 'netlify' || !conf.sitio || !conf.archivo) throw new Error('Este trabajo no está configurado para publicarse en Netlify.')

  const archivo = basename(conf.archivo)
  const origen = join(carpeta, archivo)
  if (!existsSync(origen)) throw new Error(`No encuentro el archivo ${archivo} en la carpeta del trabajo.`)

  // Se sube una carpeta limpia: el HTML como página principal (index.html) y con su nombre original
  const destino = join(tmpdir(), 'drafsoy-netlify', String(Date.now()))
  mkdirSync(destino, { recursive: true })
  copyFileSync(origen, join(destino, 'index.html'))
  copyFileSync(origen, join(destino, archivo))

  const salida = await new Promise<string>((resolve, reject) => {
    const proceso = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      // --no-build: es un HTML ya listo; sin esto Netlify intenta "construir" el sitio y falla
      ['--yes', 'netlify-cli', 'deploy', '--prod', '--no-build', '--dir', destino, '--site', conf.sitio as string, '--json'],
      { cwd: destino, shell: process.platform === 'win32', windowsHide: true, env: { ...process.env, NETLIFY_AUTH_TOKEN: CONFIG.netlifyToken } }
    )
    let texto = ''
    let errores = ''
    const reloj = setTimeout(() => {
      proceso.kill()
      reject(new Error('Netlify tardó demasiado en responder.'))
    }, 5 * 60_000)
    proceso.stdout.on('data', (d) => (texto += d))
    proceso.stderr.on('data', (d) => (errores += d))
    proceso.on('error', () => {
      clearTimeout(reloj)
      reject(new Error('No pude abrir la herramienta de Netlify (hace falta Node.js instalado).'))
    })
    proceso.on('close', (codigo) => {
      clearTimeout(reloj)
      if (codigo === 0) resolve(texto)
      else reject(new Error(`Netlify rechazó la publicación: ${(errores || texto).slice(-400)}`))
    })
  })

  const inicio = salida.indexOf('{')
  const datos = inicio >= 0 ? (JSON.parse(salida.slice(inicio)) as { url?: string; deploy_url?: string }) : {}
  const enlace = datos.url ?? datos.deploy_url ?? `https://${conf.sitio}.netlify.app`
  return { mensaje: `"${trabajo}" publicado en Netlify (${conf.sitio})`, enlace }
}
