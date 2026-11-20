import React, { useMemo } from 'react';
import { TocItem, TocNode } from './types';
import { buildTocTree } from './tocGenerator';
import { useTableOfContents } from './useTableOfContents';
import { useScrollSpy } from './useScrollSpy';
import { defaultToastStore } from '../notifications';
import './toc.css';

export interface TableOfContentsProps {
  items?: TocItem[];
  tree?: TocNode[];
  markdown?: string;
  containerRef?: React.RefObject<HTMLElement | null>;
  zoomFactor?: number;
  activeId?: string;
  onSelectHeading?: (id: string) => void;
  onClose?: () => void;
  isOpen?: boolean;
  className?: string;
  position?: 'left' | 'right';
}

/**
 * TableOfContents Component — Editorial Scrollspy Outline.
 * Conforms to Warm Editorial Minimalist Desktop design.
 * - Section counter (e.g. "02 / 12") at the top.
 * - Positionable on left (default) or right.
 * - Active heading highlighted with teal accent line and background.
 * - Click-to-scroll smooth navigation.
 */
export const TableOfContents: React.FC<TableOfContentsProps> = ({
  items: propsItems,
  tree: propsTree,
  markdown,
  containerRef,
  zoomFactor: propsZoomFactor,
  activeId: propsActiveId,
  onSelectHeading,
  onClose,
  isOpen = true,
  className = '',
  position = 'left',
}) => {
  // Use hook if explicit items/tree are not supplied
  const hookData = useTableOfContents({
    markdown: propsItems ? undefined : markdown,
    containerRef: propsItems ? undefined : containerRef,
  });

  const effectiveItems = propsItems ?? hookData.items;
  const effectiveTree = useMemo(() => {
    if (propsTree) return propsTree;
    if (propsItems) return buildTocTree(propsItems);
    return hookData.tree;
  }, [propsTree, propsItems, hookData.tree]);

  const itemIds = useMemo(() => {
    return propsActiveId ? undefined : effectiveItems.map((i) => i.id);
  }, [propsActiveId, effectiveItems]);

  const [clickedId, setClickedId] = React.useState<string | null>(null);
  const isProgrammaticScrollRef = React.useRef(false);
  const scrollTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollEndCleanupRef = React.useRef<(() => void) | null>(null);

  const spyData = useScrollSpy({
    containerRef,
    itemIds,
    isProgrammaticScrollRef,
  });

  React.useEffect(() => {
    const scrollTarget = containerRef?.current ?? (typeof window !== 'undefined' ? window : null);
    if (!scrollTarget) return;

    const handleScroll = () => {
      // Don't reset clickedId while programmatic scroll is active
      if (isProgrammaticScrollRef.current) {
        return;
      }
      setClickedId(null);
    };

    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollTarget.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (scrollEndCleanupRef.current) {
        scrollEndCleanupRef.current();
      }
    };
  }, [containerRef]);

  const activeId = propsActiveId ?? clickedId ?? spyData.activeId;
  const hasHeadings = effectiveItems.length > 0;

  const activeIndex = useMemo(() => {
    if (!activeId) return 0;
    const idx = effectiveItems.findIndex((item) => item.id === activeId);
    return idx >= 0 ? idx : 0;
  }, [effectiveItems, activeId]);

  const counterText = useMemo(() => {
    if (effectiveItems.length === 0) return '';
    const current = String(activeIndex + 1).padStart(2, '0');
    const total = String(effectiveItems.length).padStart(2, '0');
    return `${current} / ${total}`;
  }, [activeIndex, effectiveItems.length]);

  const railRef = React.useRef<HTMLElement | null>(null);
  const activeItemRef = React.useRef<HTMLLIElement | null>(null);

  // Auto-scroll active item into view within the rail as the user scrolls the document
  React.useEffect(() => {
    if (!hasHeadings || !activeItemRef.current) return;

    const mainDoc = containerRef?.current;
    const prevScrollTop = mainDoc?.scrollTop;

    if (typeof activeItemRef.current.scrollIntoView === 'function') {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }

    // When scrolling back to the top item (activeIndex === 0), scroll the TOC container
    // completely to top=0 so the first item and counter are not obscured
    if (activeIndex === 0 && railRef.current) {
      if (typeof railRef.current.scrollTo === 'function') {
        railRef.current.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      } else {
        railRef.current.scrollTop = 0;
      }
    }

    if (mainDoc && prevScrollTop !== undefined && mainDoc.scrollTop !== prevScrollTop) {
      mainDoc.scrollTop = prevScrollTop;
    }
  }, [activeIndex, hasHeadings]);

  if (!isOpen) {
    return null;
  }

  const handleHeadingClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();

    // 1. Immediately activate clicked item
    setClickedId(id);
    spyData.setActiveId(id);

    if (onSelectHeading) {
      onSelectHeading(id);
    }

    // 2. Set programmatic scroll lock to mute IntersectionObserver during scroll animation (Bug 7)
    isProgrammaticScrollRef.current = true;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
    if (scrollEndCleanupRef.current) {
      scrollEndCleanupRef.current();
      scrollEndCleanupRef.current = null;
    }

    const unlock = () => {
      isProgrammaticScrollRef.current = false;
      setClickedId(null);
      if (scrollEndCleanupRef.current) {
        scrollEndCleanupRef.current();
        scrollEndCleanupRef.current = null;
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };

    const scrollTarget = containerRef?.current ?? (typeof window !== 'undefined' ? window : null);

    if (scrollTarget) {
      const handleScrollEnd = () => {
        unlock();
      };
      const handleUserInterrupt = () => {
        unlock();
      };

      scrollTarget.addEventListener('scrollend', handleScrollEnd, { once: true });
      scrollTarget.addEventListener('wheel', handleUserInterrupt, { once: true, passive: true });
      scrollTarget.addEventListener('touchstart', handleUserInterrupt, { once: true, passive: true });

      scrollEndCleanupRef.current = () => {
        scrollTarget.removeEventListener('scrollend', handleScrollEnd);
        scrollTarget.removeEventListener('wheel', handleUserInterrupt);
        scrollTarget.removeEventListener('touchstart', handleUserInterrupt);
      };
    }

    // Safety timeout in case scrollend is not supported or not triggered (e.g., in test env or old browser)
    scrollTimeoutRef.current = setTimeout(() => {
      unlock();
    }, 1000);

    // Directly locate target element within the scrolling content root (.markdown-content)
    const root =
      (containerRef?.current as HTMLElement | null) ||
      (typeof document !== 'undefined'
        ? document.querySelector<HTMLElement>('.markdown-content')
        : null);

    const safeDecode = (val: string) => {
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    };

    let target: HTMLElement | null = null;

    if (root && typeof CSS !== 'undefined') {
      const candidates = [id, safeDecode(id)];
      for (const val of candidates) {
        try {
          const escaped = CSS.escape(val);
          target =
            root.querySelector<HTMLElement>(`#${escaped}`) ||
            root.querySelector<HTMLElement>(`[data-heading-id="${escaped}"]`) ||
            root.querySelector<HTMLElement>(`[name="${escaped}"]`);
          if (target) break;
        } catch {
          // ignore selector syntax errors
        }
      }
    }

    // Secondary fallback in case containerRef was somehow detached
    if (!target) {
      target = document.getElementById(id) || document.getElementById(safeDecode(id));
    }

    if (target) {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

      if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior, block: 'start' });
      }

      if (prefersReducedMotion) {
        unlock();
      }

      if (typeof window !== 'undefined' && window.localStorage?.getItem('debugOutline') === '1') {
        requestAnimationFrame(() => {
          const diagMsg = `[Outline Debug] Target: "${target?.id}" | scrollIntoView dispatched (behavior: ${behavior})`;
          defaultToastStore.showInfo(diagMsg);
          console.info(diagMsg);
        });
      }
    } else {
      unlock();
    }
  };

        const renderNode = (node: TocNode): React.ReactNode => {
          const isActive = activeId === node.id;

          return (
            <li
              key={node.id}
              ref={isActive ? activeItemRef : undefined}
              className={`toc-item toc-level-${node.level} ${isActive ? 'active' : ''}`}
              data-testid={`toc-item-${node.id}`}
              data-level={node.level}
            >
              <a
                href={`#${node.id}`}
                className={`spy-item toc-link ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'location' : undefined}
                onClick={(e) => handleHeadingClick(e, node.id)}
                data-testid={`toc-link-${node.id}`}
                data-target={node.id}
              >
                <span className="spy-label toc-text" dir="auto">
                  {node.text}
                </span>
                <span className="spy-marker toc-bullet" aria-hidden="true" />
              </a>

              {node.children && node.children.length > 0 && (
                <ul className="toc-sublist" role="list">
                  {node.children.map(renderNode)}
                </ul>
              )}
            </li>
          );
        };

        const handleRailWheel = (e: React.WheelEvent<HTMLElement>) => {
          const scrollTarget =
            (containerRef?.current as HTMLElement | null) ||
            (typeof document !== 'undefined'
              ? document.querySelector<HTMLElement>('.markdown-content')
              : null);
          if (scrollTarget) {
            scrollTarget.scrollTop += e.deltaY;
          }
        };

        return (
          <nav
            ref={railRef}
            className={`scrollspy-rail toc-sidebar toc-${position} ${!isOpen ? 'hidden' : ''} ${className}`.trim()}
            aria-label="Table of Contents"
            data-testid="toc-sidebar"
            data-position={position}
            dir={position === 'right' ? 'rtl' : 'ltr'}
            onWheel={handleRailWheel}
          >
            {onClose && (
              <button
                type="button"
                className="toc-close-btn"
                onClick={onClose}
                aria-label="Close Table of Contents"
                data-testid="toc-close-button"
                style={{
                  position: 'absolute',
                  width: '1px',
                  height: '1px',
                  padding: 0,
                  margin: '-1px',
                  overflow: 'hidden',
                  clip: 'rect(0, 0, 0, 0)',
                  whiteSpace: 'nowrap',
                  borderWidth: 0,
                }}
              >
                Close
              </button>
            )}
            {hasHeadings && counterText && (
              <div className="toc-counter" dir="ltr" data-testid="toc-counter">
                {counterText}
              </div>
            )}
            {!hasHeadings ? (
              <div className="toc-empty" data-testid="toc-empty" style={{ display: 'none' }}>
                No headings found in document.
              </div>
            ) : (
              <ul className="toc-list" role="list" data-testid="toc-list">
                {effectiveTree.map(renderNode)}
              </ul>
            )}
          </nav>
        );
      };
