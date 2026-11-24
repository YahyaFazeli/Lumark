/**
 * Unicode Automatic Direction Detection Engine (US-017 / FR-DIR-001)
 *
 * Implements block-level automatic text direction detection based on
 * the Unicode Bidirectional Algorithm (UBA / UAX #9 Rule P2):
 * 1. Skips leading neutral and weak characters (spaces, punctuation, digits, emojis, symbols).
 * 2. Finds the first strong directional character.
 * 3. Arabic, Persian, Hebrew, Syriac, Thaana, N'Ko, Samaritan, Mandaic letters resolve to 'rtl'.
 * 4. Latin, Greek, Cyrillic, CJK, and other script letters resolve to 'ltr'.
 * 5. If no strong directional character is found, resolves to the configured fallback (default 'ltr').
 */

import React from 'react';

export type Direction = 'rtl' | 'ltr';

// Regular expression matching strong Right-to-Left scripts (Arabic, Hebrew, Syriac, Thaana, N'Ko, Samaritan, Mandaic)
export const RTL_SCRIPT_REGEX =
  /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}]/u;

// Regular expression matching any Unicode Letter
export const UNICODE_LETTER_REGEX = /\p{L}/u;

// Regular expression matching short prefixes and bullets (e.g., "Phase 6", "1.", "8.", "○", "•", "-")
export const SHORT_PREFIX_OR_BULLET_REGEX =
  /^\s*[\p{Emoji}\p{Symbol}]*\s*(?:[•○●\-\*\+–—►▪▸✓✔]|(?:\d+[\.\)]\s*)?(?:Phase|Step|Part|Section|Chapter|Level|Release|Task|Epic|Sprint)\b|\d+[\.\)]|#+)/iu;

// Regular expression matching bullet point markers, numbered list prefixes, and markdown headings
export const LIST_MARKER_REGEX =
  /^\s*(?:[\p{Emoji}\p{Symbol}\s]|[•○●\-\*\+–—►▪▸✓✔]|\d+[\.\)]|#+)+/u;

/**
 * Strips bullet markers, list numbering, and markdown hash prefixes from text.
 */
export function stripListMarkers(text: string): string {
  return text.replace(LIST_MARKER_REGEX, '');
}

export const ARABIC_PERSIAN_UNICODE_REGEX =
  /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g;

export const LTR_LATIN_ALPHABET_REGEX = /[a-zA-Z]/g;

export const HEADING_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'heading',
]);

export const SHORT_BLOCK_TAGS = new Set([
  'li',
  'td',
  'th',
  'list-item',
  'cell',
  'table-cell',
]);

export const LONG_BLOCK_TAGS = new Set([
  'p',
  'blockquote',
  'paragraph',
]);

export interface DetectDirectionOptions {
  fallback?: Direction | null;
  stripHtml?: boolean;
}

/**
 * Strips HTML tags from text while preserving inner character sequences.
 */
export function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

/**
 * Detects the direction of a text string based on the first strong directional character.
 *
 * @param text The input text string to evaluate.
 * @param options Configuration options for fallback direction and HTML tag stripping.
 * @returns 'rtl' if the first strong character is RTL, 'ltr' if LTR, or fallback if neither.
 */
export function detectFirstStrongDirection(
  text: string,
  options?: DetectDirectionOptions
): Direction | null {
  const fallback = options?.fallback !== undefined ? options.fallback : null;
  const shouldStripHtml = options?.stripHtml !== false;
  const cleanText = shouldStripHtml ? stripHtmlTags(text) : text;

  // Iterate over full Unicode code points (properly handling surrogate pairs / astral plane characters)
  for (const char of cleanText) {
    if (UNICODE_LETTER_REGEX.test(char)) {
      return RTL_SCRIPT_REGEX.test(char) ? 'rtl' : 'ltr';
    }
  }

  return fallback;
}

/**
 * Smart Direction Detection Utility using character dominance counting with
 * block-type differentiation and document base direction awareness.
 *
 * @param text The input text string to evaluate.
 * @param docDefaultDir The document's default direction ('rtl' | 'ltr') when counts tie or both are 0.
 * @param tag Optional HTML tag name or block type (e.g. 'p', 'h1'-'h6', 'li', 'td', 'th', 'blockquote').
 * @returns 'rtl' if RTL characters dominate or document default prevails, 'ltr' otherwise.
 */
export function getTextDirection(
  text: string,
  docDefaultDir: Direction = 'ltr',
  tag?: string
): Direction {
  const safeText = text || '';
  const cleanText = stripListMarkers(safeText);
  const rtlChars = (cleanText.match(ARABIC_PERSIAN_UNICODE_REGEX) || []).length;
  const ltrChars = (cleanText.match(LTR_LATIN_ALPHABET_REGEX) || []).length;
  const normalizedTag = (tag || '').toLowerCase().trim();

  // 1. Headings (<h1> through <h6>)
  // In an RTL document, headings belong to the document context and align RTL (e.g. "Local Admin")
  if (HEADING_TAGS.has(normalizedTag)) {
    if (docDefaultDir === 'rtl') {
      return 'rtl';
    }
    // In an LTR document:
    // If Persian dominates (e.g. "عنوان اصلی با Docker"): align RTL
    if (rtlChars > ltrChars) {
      return 'rtl';
    }
    if (ltrChars > 0) {
      return 'ltr';
    }
    return docDefaultDir;
  }

  // 2. Short Blocks (<li>, <td>, <th>)
  if (SHORT_BLOCK_TAGS.has(normalizedTag)) {
    if (docDefaultDir === 'rtl') {
      // If docDefaultDir === 'rtl' and text contains at least one Persian/Arabic character, force 'rtl'
      if (rtlChars > 0) {
        return 'rtl';
      }
      // If docDefaultDir === 'rtl' and text is purely English (no Persian), keep it 'ltr'
      if (ltrChars > 0 && rtlChars === 0) {
        return 'ltr';
      }
      // Neither (e.g., numbers only "12345", emojis, symbols): fallback to docDefaultDir ('rtl')
      return docDefaultDir;
    } else {
      // If docDefaultDir === 'ltr' and text contains at least one Latin character, force 'ltr'
      if (ltrChars > 0) {
        return 'ltr';
      }
      // If docDefaultDir === 'ltr' and text is purely Persian, keep it 'rtl'
      if (rtlChars > 0 && ltrChars === 0) {
        return 'rtl';
      }
      // Neither: fallback to docDefaultDir ('ltr')
      return docDefaultDir;
    }
  }

  // 3. Long Blocks (<p>, <blockquote>) & Default Majority-Character-Count Logic
  // For long blocks (<p>, <blockquote>): Keep the majority-character-count logic
  if (rtlChars > ltrChars) {
    return 'rtl';
  }

  // If no tag is specified, preserve backward compatibility for short prefixes in RTL documents
  if (!normalizedTag && docDefaultDir === 'rtl' && SHORT_PREFIX_OR_BULLET_REGEX.test(safeText)) {
    const isShortBlock = safeText.length <= 100 || safeText.split(/\s+/).length <= 15;
    if (isShortBlock) {
      return 'rtl';
    }
  }

  if (ltrChars > rtlChars) {
    return 'ltr';
  }

  // If rtlChars === ltrChars or both are 0 (e.g., numbers, emojis, punctuation): fallback to docDefaultDir
  return docDefaultDir;
}

/**
 * Extracts prose text from a block element, ignoring text inside <pre> and <code>
 * blocks to prevent non-prose code syntax from distorting prose bidi dominance.
 */
function getBlockProseText(element: HTMLElement): string {
  if (element.querySelector('pre, code')) {
    const clone = element.cloneNode(true) as HTMLElement;
    const codeNodes = clone.querySelectorAll('pre, code');
    codeNodes.forEach((node) => node.remove());
    const stripped = clone.textContent || '';
    if (stripped.trim().length > 0) {
      return stripped;
    }
  }
  return element.textContent || '';
}

/**
 * Applies dominance-based text direction and alignment to block-level elements in a container.
 *
 * Evaluated block elements: <p>, <h1> through <h6>, <li>, <blockquote>, <td>, <th>.
 * Strictly ignores <code>, <pre>, and elements inside code/pre blocks (code blocks remain LTR).
 * Inline elements (<strong>, <em>, <span>) are not targeted.
 *
 * @param container The container DOM element containing rendered Markdown.
 * @param docDefaultDir The document's default direction ('rtl' | 'ltr').
 */
export function applyDominanceDirection(
  container: HTMLElement,
  docDefaultDir: Direction = 'ltr'
): void {
  const blockSelector = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th';
  const blockElements = container.querySelectorAll<HTMLElement>(blockSelector);

  blockElements.forEach((el) => {
    // DO NOT apply this to <code>, <pre>, or inline elements
    const tag = el.tagName.toLowerCase();
    if (tag === 'code' || tag === 'pre' || el.closest('pre, code')) {
      return;
    }

    const text = getBlockProseText(el);
    const dir = getTextDirection(text, docDefaultDir, tag);
    el.setAttribute('dir', dir);
    el.style.textAlign = dir === 'rtl' ? 'right' : 'left';
  });
}

/**
 * React hook that applies dominance-based text direction and alignment to block-level elements
 * via a post-render DOM sweep on the referenced container.
 *
 * @param containerRef Ref pointing to the container element containing rendered Markdown.
 * @param docDefaultDir The document default direction ('rtl' | 'ltr').
 * @param enabled Whether dominance-based bidi resolution is active. Defaults to true.
 */
export function useDominanceDirection(
  containerRef: React.RefObject<HTMLElement | null>,
  docDefaultDir: Direction = 'ltr',
  enabled: boolean = true
): void {
  React.useEffect(() => {
    if (!enabled || !containerRef.current) return;
    applyDominanceDirection(containerRef.current, docDefaultDir);
  }, [containerRef, docDefaultDir, enabled]);
}

/**
 * Checks if a text string has RTL direction based on first strong character.
 */
export function isRtlText(text: string): boolean {
  return detectFirstStrongDirection(text) === 'rtl';
}

export { rehypeAutoDirection, DEFAULT_AUTO_DIR_TAGS } from './autoDirectionPlugin';
export type { RehypeAutoDirectionOptions } from './autoDirectionPlugin';

export {
  getActiveDirectionPreference,
  setActiveDirectionPreference,
  resetDirectionPreference,
  subscribeDirectionPreference,
  useDirectionPreference,
} from './directionPreferences';
export type { DirectionPreference } from './directionPreferences';
