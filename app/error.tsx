'use client';
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}) {
  return <main className="panel space-y-4 rounded-xl p-6">
    <h1 className="font-display text-3xl font-bold">The court is temporarily unavailable</h1>
    <p className="text-sm text-[var(--muted)]">We couldn’t load the roster or proposal. Your working board stays saved in this browser.</p>
    <button onClick={reset} className="rounded bg-[var(--accent)] px-4 py-2 font-semibold text-[var(--ink)]">Try again</button>
  </main>;
}
