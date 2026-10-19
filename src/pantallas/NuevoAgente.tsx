import { useState } from 'react'
import { supabase } from '@/datos/supabase'
import { usarDatos } from '@/datos/DatosProvider'
import { PLANTILLAS_ROL } from '@/datos/catalogo'
import { usarRuta } from '@/navegacion'
import FormularioAgente, { type DatosAgente } from '@/componentes/FormularioAgente'
import { Pantalla, Subtitulo, Titulo } from '@/componentes/ui'

// Contratar un empleado nuevo a partir de una plantilla de rol
export default function NuevoAgente() {
  const { ajustes } = usarDatos()
  const { ir } = usarRuta()
  const [plantillaId, setPlantillaId] = useState<string>(PLANTILLAS_ROL[0].id)
  const plantilla = PLANTILLAS_ROL.find((p) => p.id === plantillaId) ?? PLANTILLAS_ROL[0]

  const inicial: DatosAgente = {
    nombre: '',
    rol: plantilla.rol,
    color: plantilla.color,
    instrucciones: plantilla.instrucciones,
    herramientas: [...plantilla.herramientas],
    modelo: ajustes?.modelo_agentes ?? 'claude-sonnet-5-5',
    acciones_con_aprobacion: [],
    tareas_recurrentes: [],
    tope_gasto_usd: 10,
    skin_avatar: null,
    skin_modelo: null
  }

  return (
    <Pantalla>
      <div className="mb-5 pr-12">
        <Titulo color="#ffc93c">Contratar empleado</Titulo>
        <p className="text-white/70">Elige una plantilla de rol y ajústala. Tendrá su propia oficina en el edificio.</p>
      </div>

      <Subtitulo>Plantilla de rol</Subtitulo>
      <div className="mb-6 grid grid-cols-3 gap-2">
        {PLANTILLAS_ROL.map((p) => (
          <button
            key={p.id}
            onClick={() => setPlantillaId(p.id)}
            className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm font-black transition ${
              p.id === plantillaId ? 'border-white bg-white/15' : 'border-white/10 bg-black/25 hover:border-white/40'
            }`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-lg" style={{ background: p.color }}>
              {p.icono}
            </span>
            {p.rol}
          </button>
        ))}
      </div>

      {/* key: al cambiar de plantilla el formulario se rellena de nuevo */}
      <FormularioAgente
        key={plantillaId}
        inicial={inicial}
        textoBoton="Contratar"
        cuentasIniciales={[]}
        alGuardar={async (datos, cuentas) => {
          if (!datos.nombre.trim()) return 'Ponle un nombre.'
          const { data, error } = await supabase.from('agentes').insert({ ...datos, nombre: datos.nombre.trim() }).select('id').single()
          if (error) return error.message
          if (cuentas.length) {
            const r = await supabase.from('agente_clientes').insert(cuentas.map((cliente_id) => ({ agente_id: data.id, cliente_id })))
            if (r.error) return r.error.message
          }
          ir({ pantalla: 'agente', id: data.id })
          return null
        }}
      />
    </Pantalla>
  )
}
