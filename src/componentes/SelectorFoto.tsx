import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'

const LADO = 192 // tamaño final de la foto guardada (px)

// Elige una imagen del ordenador, encuádrala (zoom y posición) y se guarda pequeña.
// Con "encajar" (logos) la imagen entra entera sobre fondo blanco, sin recortarse en círculo.
export default function SelectorFoto({ valor, alCambiar, encajar = false }: { valor: string | null; alCambiar: (foto: string | null) => void; encajar?: boolean }) {
  const [imagen, setImagen] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(encajar ? 0.85 : 1.6)
  const [x, setX] = useState(0.5)
  const [y, setY] = useState(encajar ? 0.5 : 0.05)
  const forma = encajar ? 'rounded-2xl' : 'rounded-full'
  const lienzo = useRef<HTMLCanvasElement>(null)
  const archivo = useRef<HTMLInputElement>(null)

  // Redibuja la vista previa (y guarda el recorte) cada vez que mueves algo
  useEffect(() => {
    if (!imagen || !lienzo.current) return
    const c = lienzo.current.getContext('2d')!
    c.clearRect(0, 0, LADO, LADO)
    if (encajar) {
      const escala = Math.min(LADO / imagen.width, LADO / imagen.height) * zoom
      const ancho = imagen.width * escala
      const alto = imagen.height * escala
      c.fillStyle = '#ffffff'
      c.fillRect(0, 0, LADO, LADO)
      c.drawImage(imagen, (LADO - ancho) / 2 + (x - 0.5) * LADO, (LADO - alto) / 2 + (y - 0.5) * LADO, ancho, alto)
    } else {
      const lado = Math.min(imagen.width, imagen.height) / zoom
      c.drawImage(imagen, (imagen.width - lado) * x, (imagen.height - lado) * y, lado, lado, 0, 0, LADO, LADO)
    }
    alCambiar(lienzo.current.toDataURL('image/webp', 0.85))
    // alCambiar cambia en cada render del padre; solo importa el encuadre
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagen, zoom, x, y, encajar])

  const abrir = (f: File | undefined) => {
    if (!f) return
    const lector = new FileReader()
    lector.onload = () => {
      const img = new Image()
      img.onload = () => setImagen(img)
      img.src = String(lector.result)
    }
    lector.readAsDataURL(f)
  }

  return (
    <div className="rounded-2xl border border-linea bg-suave p-3">
      <div className="flex items-center gap-3">
        {imagen ? (
          <canvas ref={lienzo} width={LADO} height={LADO} className={`h-20 w-20 shrink-0 ${forma} bg-white ring-2 ring-white`} />
        ) : valor ? (
          <img src={valor} alt="" className={`h-20 w-20 shrink-0 ${forma} bg-white ring-2 ring-white ${encajar ? 'object-contain' : 'object-cover'}`} />
        ) : (
          <span className={`flex h-20 w-20 shrink-0 items-center justify-center ${forma} bg-white text-tinta-suave`}>
            <ImagePlus size={24} />
          </span>
        )}
        <div className="flex flex-col gap-1.5">
          <button type="button" onClick={() => archivo.current?.click()} className="rounded-full bg-tinta px-4 py-1.5 text-xs font-semibold text-white hover:bg-black">
            {valor || imagen ? (encajar ? 'Cambiar logo' : 'Cambiar foto') : encajar ? 'Subir logo' : 'Subir foto'}
          </button>
          {(valor || imagen) && (
            <button
              type="button"
              onClick={() => {
                setImagen(null)
                alCambiar(null)
              }}
              className="flex items-center justify-center gap-1 rounded-full px-4 py-1 text-xs font-semibold text-alerta hover:bg-rose-50"
            >
              <Trash2 size={12} /> Quitar
            </button>
          )}
        </div>
        <input ref={archivo} type="file" accept="image/*" className="hidden" onChange={(e) => abrir(e.target.files?.[0])} />
      </div>
      {imagen && (
        <div className="mt-3 space-y-1.5 text-xs font-semibold text-tinta-suave">
          <Deslizador texto={encajar ? 'Tamaño' : 'Zoom'} valor={zoom} min={encajar ? 0.3 : 1} max={encajar ? 2 : 4} alCambiar={setZoom} />
          <Deslizador texto="Izquierda ↔ derecha" valor={x} min={0} max={1} alCambiar={setX} />
          <Deslizador texto="Arriba ↕ abajo" valor={y} min={0} max={1} alCambiar={setY} />
          <p className="pt-1 font-medium">{encajar ? 'Deja el logo centrado y a buen tamaño, y guarda.' : 'Encuadra la cara en el círculo y pulsa “Guardar cambios”.'}</p>
        </div>
      )}
    </div>
  )
}

function Deslizador({ texto, valor, min, max, alCambiar }: { texto: string; valor: number; min: number; max: number; alCambiar: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-32 shrink-0">{texto}</span>
      <input type="range" min={min} max={max} step={0.01} value={valor} onChange={(e) => alCambiar(Number(e.target.value))} className="w-full accent-violeta" />
    </label>
  )
}
