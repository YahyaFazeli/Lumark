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

  const spyData = useScrollSpy({
    containerRef,
    itemIds,
  });

  React.useEffect(() => {
    const scrollTarget = containerRef?.current ?? (typeof window !== 'undefined' ? window : null);
    if (!scrollTarget) return;

    const handleScroll = () => {
      setClickedId(null);
    };

    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollTarget.removeEventListener('scroll', handleScroll);
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

    if (mainDoc && prevScrollTop !== undefined && mainDoc.scrollTop !== prevScrollTop) {
      mainDoc.scrollTop = prevScrollTop;
    }
  }, [activeIndex]);

  if (!isOpen) {
    return null;
  }

  const handleHeadingClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();

    setClickedId(id);
    spyData.setActiveId(id);

    if (onSelectHeading) {
      onSelectHeading(id);
    }

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

            if (typeof window !== 'undefined' && window.localStorage?.getItem('debugOutline') === '1') {
              requestAnimationFrame(() => {
                const diagMsg = `[Outline Debug] Target: "${target?.id}" | scrollIntoView dispatched (behavior: ${behavior})`;
                defaultToastStore.showInfo(diagMsg);
                console.info(diagMsg);
              });
            }
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

        return (
          <nav
            ref={railRef}
            className={`scrollspy-rail toc-sidebar toc-${position} ${!isOpen ? 'hidden' : ''} ${className}`.trim()}
            aria-label="Table of Contents"
            data-testid="toc-sidebar"
            data-position={position}
            dir={position === 'right' ? 'rtl' : 'ltr'}
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
