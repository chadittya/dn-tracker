import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MANAGE_SECTIONS,
  pickActiveSectionIndex,
} from '../lib/manageSections';
import type { ManageSection } from '../lib/manageSections';

const NAVIGATION_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

const SCROLL_LOCK_MS = 1200;
const SPY_OFFSET_PX = 24;

function readHeaderHeight(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    '--app-header-height',
  );
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 80;
}

export function ManageSidebar() {
  const [activeId, setActiveId] = useState(MANAGE_SECTIONS[0]!.id);
  const activeIdRef = useRef(activeId);
  const lockedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const unlockCleanupRef = useRef<(() => void) | null>(null);

  const isActive = (id: string) => activeId === id;

  const setActive = useCallback((id: string) => {
    if (activeIdRef.current === id) return;
    activeIdRef.current = id;
    setActiveId(id);
  }, []);

  const measureTops = useCallback(
    () =>
      MANAGE_SECTIONS.map((section) => {
        const element = document.getElementById(section.elementId);
        if (!element) return Number.POSITIVE_INFINITY;
        return element.getBoundingClientRect().top + window.scrollY;
      }),
    [],
  );

  const updateActive = useCallback(() => {
    if (lockedRef.current) return;

    const documentHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    const viewportHeight = window.innerHeight;
    const scrollable = documentHeight > viewportHeight + 2;
    const atBottom =
      scrollable && window.scrollY + viewportHeight >= documentHeight - 2;
    const index = pickActiveSectionIndex(
      measureTops(),
      readHeaderHeight() + SPY_OFFSET_PX,
      atBottom,
    );
    const section = MANAGE_SECTIONS[index];
    if (section) setActive(section.id);
  }, [measureTops, setActive]);

  const scheduleUpdate = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      updateActive();
    });
  }, [updateActive]);

  const releaseLock = useCallback(() => {
    lockedRef.current = false;
    unlockCleanupRef.current?.();
  }, []);

  useEffect(() => {
    const onScroll = () => scheduleUpdate();
    const onResize = () => {
      releaseLock();
      scheduleUpdate();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    const observer = new ResizeObserver(() => scheduleUpdate());
    for (const section of MANAGE_SECTIONS) {
      const element = document.getElementById(section.elementId);
      if (element) observer.observe(element);
    }

    scheduleUpdate();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      releaseLock();
    };
  }, [releaseLock, scheduleUpdate]);

  const scrollToSection = (section: ManageSection) => {
    setActive(section.id);
    lockedRef.current = true;
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    unlockCleanupRef.current?.();

    const target = document.getElementById(section.elementId);
    if (!target) {
      lockedRef.current = false;
      return;
    }

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    target.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });

    const onInterrupt = () => releaseLock();
    const onKeyInterrupt = (event: KeyboardEvent) => {
      if (NAVIGATION_KEYS.has(event.key)) releaseLock();
    };
    const timeoutId = window.setTimeout(releaseLock, SCROLL_LOCK_MS);

    window.addEventListener('scrollend', onInterrupt, { once: true });
    window.addEventListener('wheel', onInterrupt, {
      once: true,
      passive: true,
    });
    window.addEventListener('touchstart', onInterrupt, {
      once: true,
      passive: true,
    });
    window.addEventListener('keydown', onKeyInterrupt);

    unlockCleanupRef.current = () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('scrollend', onInterrupt);
      window.removeEventListener('wheel', onInterrupt);
      window.removeEventListener('touchstart', onInterrupt);
      window.removeEventListener('keydown', onKeyInterrupt);
      unlockCleanupRef.current = null;
    };
  };

  return (
    <nav
      aria-label="Manage sections"
      className="lg:sticky lg:w-44 lg:shrink-0 lg:self-start"
      style={{
        top: 'calc(var(--app-header-height) + 1rem)',
        maxHeight: 'calc(100vh - var(--app-header-height) - 2rem)',
      }}
    >
      <div className="flex gap-1 overflow-x-auto pb-1 lg:max-h-[inherit] lg:flex-col lg:overflow-y-auto lg:pb-0">
        {MANAGE_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`chip shrink-0 justify-start ${
              isActive(section.id) ? 'chip-active' : 'chip-inactive'
            }`}
            aria-current={isActive(section.id) ? 'location' : undefined}
            onClick={() => scrollToSection(section)}
          >
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
