import { SearchMatch, SearchOptions } from './types';

/**
 * Escapes special regex characters in a query string.
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks whether an element should be excluded from search indexing:
 * - Hidden elements (hidden attribute, aria-hidden, display:none, visibility:hidden)
 * - Script, Style, Noscript tags
 * - SVG elements and their internals (PRD §5.6 exclusion)
 */
export function isIgnoredElement(el: Element): boolean {
  const tagName = el.tagName.toUpperCase();
  if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'NOSCRIPT' || tagName === 'SVG') {
    return true;
  }

  if (el.closest('svg') !== null) {
    return true;
  }

  if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') {
    return true;
  }

  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return true;
      }
    } catch {
      // Ignore errors in non-standard test environments
    }
  }

  return false;
}

/**
 * Collects all searchable Text nodes from a root element, skipping ignored subtrees.
 */
export function collectSearchableTextNodes(root: HTMLElement): Text[] {
  const textNodes: Text[] = [];

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (isIgnoredElement(node as Element)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_SKIP;
        }

        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentElement;
          if (parent && isIgnoredElement(parent)) {
            return NodeFilter.FILTER_REJECT;
          }
          const content = node.textContent;
          if (!content || content.trim().length === 0) {
            // Keep text nodes with whitespace if they could have matching content,
            // but empty string nodes can be skipped
            if (!content || content.length === 0) {
              return NodeFilter.FILTER_SKIP;
            }
          }
          return NodeFilter.FILTER_ACCEPT;
        }

        return NodeFilter.FILTER_SKIP;
      },
    }
  );

  let currentNode = walker.nextNode();
  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      textNodes.push(currentNode as Text);
    }
    currentNode = walker.nextNode();
  }

  return textNodes;
}

export interface TextNodeEntry {
  node: Text;
  startIndex: number;
  endIndex: number;
}

/**
 * Binary search helper to find the TextNodeEntry containing a character offset.
 */
function findEntryForOffset(
  nodeMap: TextNodeEntry[],
  charIndex: number,
  isEnd: boolean
): TextNodeEntry | undefined {
  let low = 0;
  let high = nodeMap.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const entry = nodeMap[mid];

    if (isEnd) {
      // Match ends at charIndex (exclusive): entry.startIndex < charIndex <= entry.endIndex
      if (charIndex <= entry.startIndex) {
        high = mid - 1;
      } else if (charIndex > entry.endIndex) {
        low = mid + 1;
      } else {
        return entry;
      }
    } else {
      // Match starts at charIndex (inclusive): entry.startIndex <= charIndex < entry.endIndex
      if (charIndex < entry.startIndex) {
        high = mid - 1;
      } else if (charIndex >= entry.endIndex) {
        low = mid + 1;
      } else {
        return entry;
      }
    }
  }

  return undefined;
}

/**
 * Searches the DOM tree within root for occurrences of the query string.
 * Builds a single concatenated text string with a node-offset map so searches
 * can span across multiple DOM text nodes seamlessly.
 * Returns an array of SearchMatch objects with character offsets.
 */
export function findMatches(
  root: HTMLElement | null,
  query: string,
  options: SearchOptions = {}
): SearchMatch[] {
  if (!root || !query || query.trim().length === 0) {
    return [];
  }

  const { caseSensitive = false } = options;
  const escaped = escapeRegExp(query);
  const regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi');

  const textNodes = collectSearchableTextNodes(root);
  if (textNodes.length === 0) {
    return [];
  }

  const nodeMap: TextNodeEntry[] = [];
  let fullText = '';

  for (const node of textNodes) {
    const text = node.textContent || '';
    if (text.length === 0) continue;

    const startIndex = fullText.length;
    fullText += text;
    const endIndex = fullText.length;

    nodeMap.push({
      node,
      startIndex,
      endIndex,
    });
  }

  if (fullText.length === 0 || nodeMap.length === 0) {
    return [];
  }

  const matches: SearchMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(fullText)) !== null) {
    const matchStart = match.index;
    const matchLength = match[0].length;
    const matchEnd = matchStart + matchLength;
    const matchText = match[0];

    const startEntry = findEntryForOffset(nodeMap, matchStart, false);
    const endEntry = findEntryForOffset(nodeMap, matchEnd, true);

    if (startEntry && endEntry) {
      const startOffset = matchStart - startEntry.startIndex;
      const endOffset = matchEnd - endEntry.startIndex;

      matches.push({
        index: matches.length,
        node: startEntry.node,
        startNode: startEntry.node,
        endNode: endEntry.node,
        startOffset,
        endOffset,
        text: matchText,
      });
    }

    // Guard against zero-length matches infinite loop
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }
  }

  return matches;
}
