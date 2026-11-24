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
 * Smart Direction Detection Utility using character dominance counting (RTL vs LTR).
 *
 * @param text The input text string to evaluate.
 * @param docDefaultDir The document's default direction ('rtl' | 'ltr') when counts tie or both are 0.
 * @returns 'rtl' if RTL characters dominate, 'ltr' if LTR characters dominate, or docDefaultDir on tie/empty.
 */
export function getTextDirection(
  text: string,
  docDefaultDir: Direction = 'ltr'
): Direction {
  const safeText = text || '';
  const rtlChars = (safeText.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  const ltrChars = (safeText.match(/[a-zA-Z]/g) || []).length;

  if (rtlChars > ltrChars) {
    return 'rtl';
  }
  if (ltrChars > rtlChars) {
    return 'ltr';
  }
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
    const dir = getTextDirection(text, docDefaultDir);
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
