export default function FaltaConfig() {
  return (
    <div className="flex h-full items-center justify-center bg-noche p-8">
      <div className="panel-juego max-w-lg space-y-4 p-8">
        <h1 className="titulo-juego text-3xl text-oro">Falta conectar Supabase</h1>
        <p>
          Abre el archivo <b>.env</b> en la carpeta del proyecto y rellena <b>RENDERER_VITE_SUPABASE_URL</b> y{' '}
          <b>RENDERER_VITE_SUPABASE_ANON_KEY</b> (Supabase → Project Settings → API).
        </p>
        <p className="text-white/60">Después cierra la app y vuelve a ejecutar <code>npm run dev</code>.</p>
      </div>
    </div>
  )
}
