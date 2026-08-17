'use client';

import { useEffect } from 'react';

/**
 * Reports a store card as seen once it has actually been on screen.
 *
 * Three rules, each of which exists because breaking it produces a number the
 * merchant would be right to dispute:
 *
 *  - Half the card, for half a second. A card that flickers past during a fast
 *    scroll was not seen, and counting it makes the CTR denominator fiction.
 *  - Once per store per session. Scrolling back up is not a second impression.
 *  - Batched and sent on idle/hide, not per card. Fifty cards on the directory
 *    must not mean fifty requests.
 */

const SEEN_KEY = 'idx.imp.seen';
const VISIBLE_RATIO = 0.5;
const DWELL_MS = 500;

function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function persistSeen(seen: Set<string>) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // Private-mode quota failures are not worth surfacing; the impression is
    // simply counted again next session.
  }
}

export function ImpressionTracker() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const seen = loadSeen();
    const queue = new Set<string>();
    const dwelling = new Map<Element, ReturnType<typeof setTimeout>>();

    const send = () => {
      if (!queue.size) return;
      const ids = [...queue].slice(0, 60);
      queue.clear();

      const body = JSON.stringify({ ids });
      // sendBeacon survives the pagehide that a click to a merchant site
      // triggers; fetch does not reliably.
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/impressions', body);
      } else {
        void fetch('/api/impressions', { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    };

    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSend = () => {
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        send();
      }, 1_000);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.impressionId;
          if (!id) continue;

          if (entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO) {
            if (seen.has(id) || dwelling.has(entry.target)) continue;
            dwelling.set(
              entry.target,
              setTimeout(() => {
                dwelling.delete(entry.target);
                if (seen.has(id)) return;
                seen.add(id);
                persistSeen(seen);
                queue.add(id);
                scheduleSend();
                observer.unobserve(entry.target);
              }, DWELL_MS),
            );
          } else {
            const pending = dwelling.get(entry.target);
            if (pending) {
              clearTimeout(pending);
              dwelling.delete(entry.target);
            }
          }
        }
      },
      { threshold: [VISIBLE_RATIO] },
    );

    const observeWithin = (root: ParentNode) => {
      const cards = root.querySelectorAll<HTMLElement>('[data-impression-id]');
      cards.forEach((el) => {
        if (!seen.has(el.dataset.impressionId ?? '')) observer.observe(el);
      });
    };
    observeWithin(document);

    /**
     * This component is mounted once in the root layout, which does not
     * re-render on client-side navigation — so a one-shot querySelectorAll
     * would silently stop counting the moment a shopper navigated from the
     * directory to a collection. Watching the DOM catches every subsequent
     * page without coupling this to usePathname (which misses ?q= changes on
     * /search) or useSearchParams (which would opt the entire app out of
     * static rendering).
     */
    const domObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.dataset.impressionId && !seen.has(node.dataset.impressionId)) {
            observer.observe(node);
          }
          observeWithin(node);
        });
      }
    });
    domObserver.observe(document.body, { childList: true, subtree: true });

    // Leaving the page is the last chance to report what is already queued.
    const onHide = () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      send();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);

    return () => {
      observer.disconnect();
      domObserver.disconnect();
      dwelling.forEach((t) => clearTimeout(t));
      if (flushTimer) clearTimeout(flushTimer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      send();
    };
  }, []);

  return null;
}
