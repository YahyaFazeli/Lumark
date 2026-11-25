import { SearchMatch, SearchOptions } from './types';
import { findMatches } from './searchIndexer';

interface HighlightInstance {
  priority?: number;
}

interface HighlightConstructor {
  new (...ranges: AbstractRange[]): HighlightInstance;
}

interface HighlightRegistry {
  set(name: string, highlight: HighlightInstance): void;
  delete(name: string): boolean;
}

function getCssHighlights(): HighlightRegistry | null {
  if (
    typeof CSS !== 'undefined' &&
    'highlights' in CSS &&
    typeof (globalThis as unknown as { Highlight?: HighlightConstructor }).Highlight !== 'undefined'
  ) {
    return (CSS as unknown as { highlights: HighlightRegistry }).highlights;
  }
  return null;
}

function getHighlightConstructor(): HighlightConstructor {
  return (globalThis as unknown as { Highlight: HighlightConstructor }).Highlight;
}

/**
 * Checks whether the CSS Custom Highlight API is supported in the current runtime.
 */
export function supportsCssHighlights(): boolean {
  return getCssHighlights() !== null;
}

/**
 * Removes all search highlight marks and clears CSS Highlight API registrations,
 * restoring the DOM to its original normalized state.
 */
export function clearHighlights(root: HTMLElement | null): void {
  const registry = getCssHighlights();
  if (registry) {
    registry.delete('search-match');
    registry.delete('search-active');
  }

  if (!root) return;

  const marks = root.querySelectorAll('mark[data-search-match="true"]');
  if (marks.length === 0) return;

  const affectedParents = new Set<Node>();

  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      affectedParents.add(parent);
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
    }
  });

  affectedParents.forEach((parent) => {
    if (typeof (parent as Element).normalize === 'function') {
      (parent as Element).normalize();
    }
  });

  if (typeof root.normalize === 'function') {
    root.normalize();
  }
}

/**
 * Collects all Text nodes between startNode and endNode (inclusive) in document order.
 */
function collectTextNodesBetween(root: HTMLElement, startNode: Text, endNode: Text): Text[] {
  if (startNode === endNode) {
    return [startNode];
  }

  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let collecting = false;
  let current = walker.nextNode();

  while (current) {
    if (current === startNode) {
      collecting = true;
    }
    if (collecting) {
      nodes.push(current as Text);
    }
    if (current === endNode) {
      break;
    }
    current = walker.nextNode();
  }

  return nodes;
}

function createMarkElement(matchIndex: number, isActive: boolean): HTMLElement {
  const mark = document.createElement('mark');
  mark.className = 'search-match';
  mark.setAttribute('data-search-match', 'true');
  mark.setAttribute('data-match-index', String(matchIndex));

  if (isActive) {
    mark.classList.add('active');
    mark.setAttribute('data-search-active', 'true');
  }

  return mark;
}

/**
 * Applies highlights using the CSS Custom Highlight API when available,
 * or falls back to DOM `<mark>` wrapping via `range.surroundContents()`.
 * Returns the active Range or active `<mark>` element (or null if none).
 */
export function applyHighlights(
  root: HTMLElement | null,
  matches: SearchMatch[],
  activeIndex: number = 0
): Range | HTMLElement | null {
  if (!root || !matches || matches.length === 0) {
    clearHighlights(root);
    return null;
  }

  const registry = getCssHighlights();
  if (registry) {
    const HighlightCtor = getHighlightConstructor();
    const ranges: Range[] = [];

    for (const match of matches) {
      const startNode = match.startNode || match.node;
      const endNode = match.endNode || match.node;
      if (!startNode || !endNode || !startNode.parentNode || !endNode.parentNode) continue;

      const startLen = startNode.textContent?.length ?? 0;
      const endLen = endNode.textContent?.length ?? 0;
      if (match.startOffset < 0 || match.startOffset > startLen) continue;
      if (match.endOffset < 0 || match.endOffset > endLen) continue;

      try {
        const range = document.createRange();
        range.setStart(startNode, match.startOffset);
        range.setEnd(endNode, match.endOffset);
        ranges.push(range);
      } catch (err) {
        console.warn('Failed to create highlight range:', err);
      }
    }

    if (ranges.length === 0) {
      return null;
    }

    registry.set('search-match', new HighlightCtor(...ranges));

    const activeRange =
      activeIndex >= 0 && activeIndex < ranges.length ? ranges[activeIndex] : null;
    if (activeRange) {
      const activeHighlight = new HighlightCtor(activeRange);
      activeHighlight.priority = 1;
      registry.set('search-active', activeHighlight);
    }

    return activeRange;
  }

  // Fallback: DOM <mark> wrapping using range.surroundContents() on single-text-node slices.
  // Process in reverse match order so earlier offsets in shared text nodes remain valid.
  const reverseMatches = [...matches].sort((a, b) => b.index - a.index);
  let activeMark: HTMLElement | null = null;

  for (const match of reverseMatches) {
    const startNode = match.startNode || match.node;
    const endNode = match.endNode || match.node;
    if (!startNode || !endNode || !startNode.parentNode || !endNode.parentNode) continue;

    const isActive = activeIndex >= 0 && match.index === activeIndex;

    try {
      if (startNode === endNode) {
        const len = startNode.textContent?.length ?? 0;
        if (match.startOffset < 0 || match.endOffset > len || match.startOffset >= match.endOffset) {
          continue;
        }
        const range = document.createRange();
        range.setStart(startNode, match.startOffset);
        range.setEnd(endNode, match.endOffset);

        const mark = createMarkElement(match.index, isActive);
        range.surroundContents(mark);
        if (isActive) {
          activeMark = mark;
        }
      } else {
        // Cross-tag match: wrap each contributing single-text-node slice in reverse order
        const segmentNodes = collectTextNodesBetween(root, startNode, endNode);
        for (let i = segmentNodes.length - 1; i >= 0; i--) {
          const textNode = segmentNodes[i];
          const textLen = textNode.textContent?.length ?? 0;
          if (textLen === 0) continue;

          const segStart = textNode === startNode ? match.startOffset : 0;
          const segEnd = textNode === endNode ? match.endOffset : textLen;
          if (segStart < 0 || segEnd > textLen || segStart >= segEnd) continue;

          const subRange = document.createRange();
          subRange.setStart(textNode, segStart);
          subRange.setEnd(textNode, segEnd);

          const mark = createMarkElement(match.index, isActive);
          subRange.surroundContents(mark);
          if (isActive && i === 0) {
            activeMark = mark;
          }
        }
      }
    } catch (err) {
      console.warn('Failed to wrap match range in highlight mark:', err);
    }
  }

  return activeMark;
}

/**
 * Executes the full synchronous search pipeline in order:
 * 1. clearHighlights(root)
 * 2. findMatches(root, query, { caseSensitive })
 * 3. applyHighlights(root, matches, activeIndex)
 */
export function runSearch(
  root: HTMLElement | null,
  query: string,
  options: SearchOptions & { activeIndex?: number } = {}
): { matches: SearchMatch[]; activeTarget: Range | HTMLElement | null } {
  clearHighlights(root);

  if (!root || !query || query.trim().length === 0) {
    return { matches: [], activeTarget: null };
  }

  const matches = findMatches(root, query, { caseSensitive: options.caseSensitive });
  if (matches.length === 0) {
    return { matches: [], activeTarget: null };
  }

  const activeIndex = options.activeIndex ?? 0;
  const activeTarget = applyHighlights(root, matches, activeIndex);
  return { matches, activeTarget };
}

/**
 * Scrolls the container (or viewport) to center the active Range or `<mark>` element
 * using `getBoundingClientRect()`.
 */
export function scrollToMatch(
  container: HTMLElement | null,
  activeRangeOrMark: Range | HTMLElement | null
): void {
  if (!container || !activeRangeOrMark) return;

  const rect = activeRangeOrMark.getBoundingClientRect();

  // In non-layout environments like jsdom, getBoundingClientRect() returns all zeros;
  // fall back to scrollIntoView for HTMLElements when available.
  if (
    rect.width === 0 &&
    rect.height === 0 &&
    activeRangeOrMark instanceof HTMLElement &&
    typeof activeRangeOrMark.scrollIntoView === 'function'
  ) {
    activeRangeOrMark.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    return;
  }

  const containerRect = container.getBoundingClientRect();
  if (container.scrollHeight > container.clientHeight && typeof container.scrollTo === 'function') {
    const targetTop =
      container.scrollTop +
      (rect.top - containerRect.top) -
      container.clientHeight / 2 +
      rect.height / 2;
    container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  } else if (
    activeRangeOrMark instanceof HTMLElement &&
    typeof activeRangeOrMark.scrollIntoView === 'function'
  ) {
    activeRangeOrMark.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  } else if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    const targetTop = window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  }
}

/**
 * Updates the active highlight indicator between matches and scrolls to the new active match.
 */
export function updateActiveHighlight(
  root: HTMLElement | null,
  previousIndex: number,
  newIndex: number,
  matches?: SearchMatch[]
): Range | HTMLElement | null {
  if (!root) return null;

  const registry = getCssHighlights();
  if (registry && matches && newIndex >= 0 && newIndex < matches.length) {
    const match = matches[newIndex];
    const startNode = match.startNode || match.node;
    const endNode = match.endNode || match.node;
    if (startNode && endNode && startNode.parentNode && endNode.parentNode) {
      const range = document.createRange();
      range.setStart(startNode, match.startOffset);
      range.setEnd(endNode, match.endOffset);
      const HighlightCtor = getHighlightConstructor();
      const activeHighlight = new HighlightCtor(range);
      activeHighlight.priority = 1;
      registry.set('search-active', activeHighlight);
      scrollToMatch(root, range);
      return range;
    }
    return null;
  }

  if (previousIndex >= 0) {
    const prevElements = root.querySelectorAll<HTMLElement>(
      `mark[data-search-match="true"][data-match-index="${previousIndex}"]`
    );
    prevElements.forEach((prev) => {
      prev.classList.remove('active');
      prev.removeAttribute('data-search-active');
    });
  }

  const nextElements = root.querySelectorAll<HTMLElement>(
    `mark[data-search-match="true"][data-match-index="${newIndex}"]`
  );
  if (nextElements.length > 0) {
    nextElements.forEach((next) => {
      next.classList.add('active');
      next.setAttribute('data-search-active', 'true');
    });
    const firstNext = nextElements[0];
    scrollToMatch(root, firstNext);
    return firstNext;
  }

  return null;
}
