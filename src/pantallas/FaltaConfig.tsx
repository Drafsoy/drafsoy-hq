export default function FaltaConfig() {
  return (
    <div className="flex h-full items-center justify-center bg-fondo p-8">
      <div className="tarjeta max-w-lg space-y-4 p-8">
        <h1 className="text-3xl font-bold text-tinta">Falta conectar Supabase</h1>
        <p>
          Abre el archivo <b>.env</b> en la carpeta del proyecto y rellena <b>RENDERER_VITE_SUPABASE_URL</b> y{' '}
          <b>RENDERER_VITE_SUPABASE_ANON_KEY</b> (Supabase → Project Settings → API).
        </p>
        <p className="text-tinta-suave">Después cierra la app y vuelve a ejecutar <code>npm run dev</code>.</p>
      </div>
    </div>
  )
}
