import Link from 'next/link';

const checks = [
  ['Adaptive interview', 'Multi-turn technical scenarios with follow-up probes and pivots.'],
  ['Evidence-based scoring', 'Short or non-technical answers are not treated as proof of weak ability.'],
  ['Insufficient-evidence guard', 'Domains remain unscored until enough technical evidence exists.'],
  ['Production hardening', 'Input limits, rate limiting, safe API errors, and no client-side API secret.'],
  ['Proctoring flow', 'Focus-loss warning, grace period, and violation termination are implemented.'],
  ['Automated E2E coverage', 'Playwright covers interview completion and insufficient-evidence behavior.'],
];

export default function ShowcasePage() {
  return (
    <main className="min-h-screen bg-dark-bg text-gray-100 p-6 sm:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="glass-panel rounded-3xl p-8 border border-violet-deep/30">
          <div className="inline-flex px-3 py-1 rounded-full bg-violet-deep/20 text-violet-light border border-violet-deep/40 text-xs font-mono">COMPETITION SUBMISSION • PUBLIC DEMO</div>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-violet-light">AI Technical Interview Agent</h1>
          <p className="mt-4 max-w-3xl text-gray-300 leading-relaxed">A production-oriented adaptive technical interview experience that evaluates demonstrated engineering reasoning, handles insufficient evidence safely, and produces an auditable technical-depth report.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/demo" className="px-5 py-3 rounded-xl bg-purple-gradient text-white text-sm font-semibold shadow-lg shadow-violet-deep/20">Launch Sanitized Interactive Demo</Link>
            <a href="https://github.com/arcadesignal2025-debug/Interview_assistant" target="_blank" rel="noreferrer" className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-gray-200 hover:bg-white/10">View Source on GitHub</a>
          </div>
          <p className="mt-4 text-xs text-gray-500">The demo uses synthetic competition data only. No private candidate records are required to view or test this page.</p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {checks.map(([title, description]) => (
            <div key={title} className="glass-card rounded-2xl p-5 border border-white/10">
              <div className="text-sm font-semibold text-white">{title}</div>
              <div className="mt-2 text-xs leading-relaxed text-gray-400">{description}</div>
            </div>
          ))}
        </section>

        <section className="glass-card rounded-2xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white">Submission safety boundary</h2>
          <p className="mt-2 text-sm text-gray-400 leading-relaxed">This coordinator-facing route is intentionally separate from the candidate evaluator. It exposes only the project overview and a synthetic interactive demo. The Anthropic API key remains server-side and is never rendered into the browser.</p>
        </section>
      </div>
    </main>
  );
}
