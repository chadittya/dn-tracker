import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAppState } from '../state/context';
import { TABS } from '../lib/navigation';
import type { Tab } from '../lib/navigation';
import { ErrorBanner } from './ErrorBanner';
import { ResetCountdown } from './ResetCountdown';
import { ThemeToggle } from './ThemeToggle';

export function AppShell({
  tab,
  onNavigate,
  children,
}: {
  tab: Tab;
  onNavigate: (tab: Tab) => void;
  children: ReactNode;
}) {
  const { error, clearError } = useAppState();
  const headerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const root = document.documentElement;
    const publishHeight = () => {
      root.style.setProperty(
        '--app-header-height',
        `${header.getBoundingClientRect().height}px`,
      );
    };

    publishHeight();
    const observer = new ResizeObserver(publishHeight);
    observer.observe(header);
    window.addEventListener('resize', publishHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publishHeight);
      root.style.removeProperty('--app-header-height');
    };
  }, []);

  return (
    <div className="min-h-screen">
      <header
        ref={headerRef}
        className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">
              DN
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Dragon Nest</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Run Tracker
              </p>
            </div>
          </div>

          <nav
            aria-label="Main navigation"
            className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto px-1 md:order-2 md:mx-0 md:w-auto md:flex-1 md:px-0"
          >
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={tab === item.id ? 'page' : undefined}
                className={`min-h-10 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors ${
                  tab === item.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:order-3">
            <ResetCountdown compact />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        {error && <ErrorBanner message={error} onDismiss={clearError} />}
        {children}
      </main>
    </div>
  );
}
