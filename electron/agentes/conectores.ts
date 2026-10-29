import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Conexión con Meta Ads y HubSpot a través del Claude Code de esta PC, que ya tiene esas cuentas conectadas.
// SOLO LECTURA: Claude Code recibe la lista exacta de herramientas permitidas (buscar, leer, métricas) y bloquea
// cualquier otra. Crear, cambiar, pausar o borrar nunca está en la lista: eso va por una propuesta a la bandeja.

export type Conector = 'meta' | 'hubspot'

const SERVIDOR: Record<Conector, string> = { meta: 'mcp__claude_ai_Facebook__', hubspot: 'mcp__claude_ai_HubSpot__' }

const LECTURA: Record<Conector, string[]> = {
  meta: [
    'ads_account_get_activity_logs',
    'ads_catalog_event_source_get',
    'ads_catalog_event_source_get_catalogs',
    'ads_catalog_event_source_get_health',
    'ads_catalog_event_source_get_recommendations',
    'ads_catalog_get_businesses',
    'ads_catalog_get_data_sources',
    'ads_catalog_get_diagnostics',
    'ads_catalog_get_dynamic_ads_health',
    'ads_catalog_get_feed_rules',
    'ads_catalog_get_suggested_filter',
    'ads_catalog_list_catalogs',
    'ads_catalog_list_dpa_eligible_catalogs',
    'ads_catalog_list_partner_integrations',
    'ads_catalog_list_product_feeds',
    'ads_catalog_list_product_sets',
    'ads_catalog_list_products',
    'ads_experiment_abtest_get_test',
    'ads_experiment_check_eligibility',
    'ads_experiment_lift_get_test',
    'ads_experiment_list_tests',
    'ads_get_ad_account_custom_audiences',
    'ads_get_ad_account_pages',
    'ads_get_ad_accounts',
    'ads_get_ad_entities',
    'ads_get_ad_images',
    'ads_get_ad_preview',
    'ads_get_ad_preview_screenshot',
    'ads_get_ad_videos',
    'ads_get_creative_ads',
    'ads_get_creatives',
    'ads_get_custom_audience',
    'ads_get_custom_audience_adsets',
    'ads_get_customconversions',
    'ads_get_dataset_details',
    'ads_get_dataset_quality',
    'ads_get_dataset_stats',
    'ads_get_datasets',
    'ads_get_errors',
    'ads_get_field_context',
    'ads_get_help_article',
    'ads_get_ig_accounts',
    'ads_get_ig_media',
    'ads_get_opportunity_score',
    'ads_get_pages_for_business',
    'ads_get_user_pages',
    'ads_insights_advertiser_context',
    'ads_insights_anomaly_signal',
    'ads_insights_auction_ranking_benchmarks',
    'ads_insights_industry_benchmark',
    'ads_insights_performance_trend',
    'ads_insights_performance_vs_peers',
    'ads_library_search',
    'ads_pixel_event_read',
    'ads_pixel_parameter_read',
  ],
  hubspot: [
    'discover_hubspot_schema',
    'get_aeo_metrics',
    'get_campaign_attribution_reports',
    'get_content_analytics_report',
    'get_crm_objects',
    'get_organization_details',
    'get_properties',
    'get_user_details',
    'query_crm_data',
    'query_segments',
    'read_campaign_data',
    'search_crm_objects',
    'search_intent_signals',
    'search_owners',
    'search_properties',
    'tool_guidance',
  ]
}

const NOMBRE: Record<Conector, string> = { meta: 'Meta Ads (Facebook e Instagram)', hubspot: 'HubSpot' }
const LIMITE_MS = 5 * 60_000

// Carpeta vacía para que Claude Code no lea las instrucciones de ningún proyecto
const carpeta = join(tmpdir(), 'drafsoy-conectores')

export async function consultarConector(conector: Conector, pregunta: string): Promise<string> {
  mkdirSync(carpeta, { recursive: true })
  const permitidas = LECTURA[conector].map((h) => SERVIDOR[conector] + h)
  const instrucciones =
    `Eres un asistente de solo lectura de ${NOMBRE[conector]} para la agencia Drafsoy. Responde en español.\n` +
    'Usa únicamente las herramientas de consulta que tienes permitidas; no intentes crear, cambiar, pausar ni borrar nada.\n' +
    'Devuelve los datos reales que encuentres (nombres, ids, fechas, cifras) de forma ordenada y breve. ' +
    'Si algo no se puede consultar o no existe, dilo claramente. No inventes datos.\n\n' +
    `Consulta: ${pregunta}`

  return new Promise((resolve, reject) => {
    const proceso = spawn(
      process.platform === 'win32' ? 'claude.cmd' : 'claude',
      [
        '-p',
        '--output-format', 'json',
        '--permission-mode', 'default',
        '--allowedTools', permitidas.join(','),
        '--disallowedTools', 'Bash,Edit,Write,NotebookEdit,WebFetch,WebSearch'
      ],
      { cwd: carpeta, shell: process.platform === 'win32', windowsHide: true }
    )
    let salida = ''
    let errores = ''
    const reloj = setTimeout(() => {
      proceso.kill()
      reject(new Error(`${NOMBRE[conector]} tardó demasiado en responder.`))
    }, LIMITE_MS)
    proceso.stdout.on('data', (d) => (salida += d))
    proceso.stderr.on('data', (d) => (errores += d))
    proceso.on('error', () => {
      clearTimeout(reloj)
      reject(new Error('No encontré Claude Code en esta computadora. Instálalo e inicia sesión para usar Meta y HubSpot.'))
    })
    proceso.on('close', () => {
      clearTimeout(reloj)
      try {
        const r = JSON.parse(salida) as { result?: string; is_error?: boolean }
        if (r.is_error || !r.result) return reject(new Error(r.result || 'Claude Code no pudo hacer la consulta.'))
        resolve(r.result)
      } catch {
        reject(new Error(`Claude Code no respondió bien: ${(errores || salida).slice(0, 300)}`))
      }
    })
    proceso.stdin.end(instrucciones)
  })
}
