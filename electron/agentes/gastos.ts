import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

// Precio por millón de tokens (entrada, salida) en USD.
const PRECIOS: Record<string, [number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-sonnet-5-5': [2, 10],
  'claude-opus-5-5': [4, 20]
}

export function costeUsd(modelo: string, uso: Anthropic.Usage): number {
  const [entrada, salida] = PRECIOS[modelo] ?? PRECIOS['claude-opus-5-5']
  const tokensEntrada = uso.input_tokens + (uso.cache_creation_input_tokens ?? 0) * 1.25 + (uso.cache_read_input_tokens ?? 0) * 0.1
  return (tokensEntrada * entrada + uso.output_tokens * salida) / 1_000_000
}

const inicioDeMes = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

// ¿Cuánto se ha gastado este mes? (todo, y lo de un agente concreto)
export async function gastoDelMes(db: SupabaseClient, agenteId: string) {
  const { data, error } = await db.from('gastos').select('agente_id, costo_usd').gte('creado_en', inicioDeMes())
  if (error) throw new Error(`No pude leer los gastos: ${error.message}`)
  let total = 0
  let delAgente = 0
  for (const g of data ?? []) {
    total += Number(g.costo_usd)
    if (g.agente_id === agenteId) delAgente += Number(g.costo_usd)
  }
  return { total, delAgente }
}

export async function registrarGasto(
  db: SupabaseClient,
  datos: { agenteId: string; tareaId?: string | null; modelo: string; entrada: number; salida: number; coste: number }
) {
  await db.from('gastos').insert({
    agente_id: datos.agenteId,
    tarea_id: datos.tareaId ?? null,
    modelo: datos.modelo,
    tokens_entrada: datos.entrada,
    tokens_salida: datos.salida,
    costo_usd: Number(datos.coste.toFixed(6))
  })
}
