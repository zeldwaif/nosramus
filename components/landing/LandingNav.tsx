import Link from "next/link";

export default function LandingNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-edge/40 bg-background/75 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6 md:px-8">
        <Link
          href="/"
          className="group flex items-baseline gap-2 font-display text-lg font-semibold tracking-tight"
        >
          Nosramus
          <span className="hidden font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-muted sm:inline">
            beta
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <a
            href="#workflow"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            Workflow
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost hidden h-9 px-3 text-sm sm:inline-flex">
            Sign in
          </Link>
          <Link href="/login" className="btn-primary h-9 px-4 text-sm">
            Open app
          </Link>
        </div>
      </div>
    </header>
  );
}
