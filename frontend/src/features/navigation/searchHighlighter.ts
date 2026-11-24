import { SearchMatch } from './types';

const RTL_SCRIPT_REGEX =
  /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}]/u;
const LTR_SCRIPT_REGEX = /[a-zA-Z\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}]/u;

/**
 * Checks whether a text string contains LTR script characters and no RTL script characters.
 */
export function isPureLtr(text: string): boolean {
  return LTR_SCRIPT_REGEX.test(text) && !RTL_SCRIPT_REGEX.test(text);
}

const VOID_ELEMENT_TAGS = new Set([
  'AREA',
  'BASE',
  'BR',
  'COL',
  'EMBED',
  'HR',
  'IMG',
  'INPUT',
  'LINK',
  'META',
  'PARAM',
  'SOURCE',
  'TRACK',
  'WBR',
]);

const MERGEABLE_INLINE_TAGS = new Set([
  'STRONG',
  'EM',
  'B',
  'I',
  'CODE',
  'SPAN',
  'U',
  'S',
  'DEL',
  'SUB',
  'SUP',
  'KBD',
  'SAMP',
  'VAR',
  'MARK',
]);

/**
 * Removes empty leftover elements (e.g. from range.extractContents() splitting)
 * without deleting void elements (like <img/>, <hr/>, <br/>) or elements with IDs.
 */
export function cleanEmptyElements(root: HTMLElement): void {
  const elements = root.querySelectorAll('*');
  elements.forEach((el) => {
    if (
      !VOID_ELEMENT_TAGS.has(el.tagName) &&
      !el.matches('mark[data-search-match="true"]') &&
      el.textContent === '' &&
      !el.hasAttribute('id') &&
      el.querySelectorAll(Array.from(VOID_ELEMENT_TAGS).join(',')).length === 0
    ) {
      el.remove();
    }
  });
}

/**
 * Merges adjacent sibling elements of the same inline tag and identical attributes
 * that may have been split during range extraction.
 */
export function mergeAdjacentIdenticalElements(root: HTMLElement): void {
  const elements = root.querySelectorAll('*');
  elements.forEach((el) => {
    if (!MERGEABLE_INLINE_TAGS.has(el.tagName)) return;
    let next = el.nextSibling;
    while (
      next &&
      next.nodeType === Node.ELEMENT_NODE &&
      (next as Element).tagName === el.tagName &&
      (next as Element).attributes.length === el.attributes.length &&
      Array.from((next as Element).attributes).every(
        (attr) => el.getAttribute(attr.name) === attr.value
      )
    ) {
      const nextEl = next as Element;
      while (nextEl.firstChild) {
        el.appendChild(nextEl.firstChild);
      }
      next = nextEl.nextSibling;
      nextEl.remove();
    }
  });
}

/**
 * Removes all search highlight mark elements from the container and normalizes
 * text nodes and split elements, restoring the DOM to its exact original structure.
 */
export function clearHighlights(root: HTMLElement | null): void {
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

  cleanEmptyElements(root);
  mergeAdjacentIdenticalElements(root);

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
 * Applies non-destructive `<mark>` highlights around text matches using the Range API.
 * Handles both single-node and cross-node matches without splitting tags destructively.
 * Matches are processed in reverse order (descending by index / document position) so that
 * later DOM modifications do not invalidate earlier text nodes or character offsets.
 */
export function applyHighlights(
  root: HTMLElement | null,
  matches: SearchMatch[],
  activeIndex: number = 0
): HTMLElement[] {
  if (!root || !matches || matches.length === 0) {
    clearHighlights(root);
    return [];
  }

  // Always clear previous highlights first to avoid double-wrapping
  clearHighlights(root);

  const markElements: HTMLElement[] = [];

  // Sort descending by index so earlier splits/extractions don't invalidate later ones
  const reverseMatches = [...matches].sort((a, b) => b.index - a.index);

  for (const match of reverseMatches) {
    const startNode = match.startNode || match.node;
    const endNode = match.endNode || match.node;

    if (!startNode || !endNode) continue;
    if (!startNode.parentNode || !endNode.parentNode) continue;

    const startNodeLength = startNode.textContent?.length ?? 0;
    const endNodeLength = endNode.textContent?.length ?? 0;

    if (match.startOffset < 0 || match.startOffset > startNodeLength) continue;
    if (match.endOffset < 0 || match.endOffset > endNodeLength) continue;

    try {
      const range = document.createRange();
      range.setStart(startNode, match.startOffset);
      range.setEnd(endNode, match.endOffset);

      const frag = range.extractContents();

      const mark = document.createElement('mark');
      mark.className = 'search-match search-highlight';
      mark.setAttribute('data-search-match', 'true');
      mark.setAttribute('data-match-index', String(match.index));

      // If the matched search term is purely LTR (English), set dir="ltr"
      // to ensure correct character ordering within an RTL context
      if (isPureLtr(match.text)) {
        mark.setAttribute('dir', 'ltr');
      }

      // Isolated bidi styling to prevent reordering by surrounding text
      mark.style.display = 'inline';
      mark.style.direction = 'inherit';
      mark.style.unicodeBidi = 'isolate';
      mark.style.padding = '0';
      mark.style.margin = '0';

      if (match.index === activeIndex) {
        mark.classList.add('active');
        mark.setAttribute('data-search-active', 'true');
      }

      mark.appendChild(frag);

      // Merge adjacent identical inline tags and normalize text nodes inside the mark
      // to ensure the browser doesn't render the word as separate pieces
      mergeAdjacentIdenticalElements(mark);
      if (typeof mark.normalize === 'function') {
        mark.normalize();
      }

      range.insertNode(mark);
      markElements.push(mark);
    } catch (err) {
      console.warn('Failed to wrap match range in highlight mark:', err);
    }
  }

  // Clean empty tags that might have been left behind by extractContents()
  cleanEmptyElements(root);

  // Sort mark elements by their match index ascending
  markElements.sort((a, b) => {
    const idxA = Number(a.getAttribute('data-match-index') || 0);
    const idxB = Number(b.getAttribute('data-match-index') || 0);
    return idxA - idxB;
  });

  // Scroll initial active mark into view if available
  if (activeIndex >= 0 && activeIndex < markElements.length) {
    const activeEl = markElements.find(
      (m) => m.getAttribute('data-match-index') === String(activeIndex)
    );
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }

  return markElements;
}

/**
 * Updates the active highlight indicator between matches and smoothly scrolls the
 * new active match into the center of the viewport.
 */
export function updateActiveHighlight(
  root: HTMLElement | null,
  previousIndex: number,
  newIndex: number
): HTMLElement | null {
  if (!root) return null;

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
    if (typeof firstNext.scrollIntoView === 'function') {
      firstNext.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
    return firstNext;
  }

  return null;
}
