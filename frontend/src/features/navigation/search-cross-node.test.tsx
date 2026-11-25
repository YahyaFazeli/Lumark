import React, { useRef } from 'react';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { findMatches } from './searchIndexer';
import { applyHighlights, clearHighlights } from './searchHighlighter';
import { useSearch } from './useSearch';
import { MarkdownViewer } from '../rendering/MarkdownViewer';

describe('Cross-Node Search & Multi-Element Highlighting', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn();
    }
  });

  afterEach(() => {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  });

  describe('findMatches Cross-Node Mapping', () => {
    it('finds matches spanning across multiple text nodes and HTML elements', () => {
      container.innerHTML = '<p>Search <strong>across</strong> tags</p>';

      // Search for "Search across"
      const matches1 = findMatches(container, 'Search across');
      expect(matches1).toHaveLength(1);
      expect(matches1[0].text).toBe('Search across');
      expect(matches1[0].startNode.textContent).toBe('Search ');
      expect(matches1[0].startOffset).toBe(0);
      expect(matches1[0].endNode.textContent).toBe('across');
      expect(matches1[0].endOffset).toBe(6);

      // Search for "across tags"
      const matches2 = findMatches(container, 'across tags');
      expect(matches2).toHaveLength(1);
      expect(matches2[0].text).toBe('across tags');
      expect(matches2[0].startNode.textContent).toBe('across');
      expect(matches2[0].startOffset).toBe(0);
      expect(matches2[0].endNode.textContent).toBe(' tags');
      expect(matches2[0].endOffset).toBe(5);

      // Search for "Search across tags"
      const matches3 = findMatches(container, 'Search across tags');
      expect(matches3).toHaveLength(1);
      expect(matches3[0].text).toBe('Search across tags');
      expect(matches3[0].startNode.textContent).toBe('Search ');
      expect(matches3[0].startOffset).toBe(0);
      expect(matches3[0].endNode.textContent).toBe(' tags');
      expect(matches3[0].endOffset).toBe(5);
    });

    it('finds multiple cross-node matches across identical patterns in the DOM', () => {
      container.innerHTML =
        '<p>Search <strong>across</strong> tags and again Search <strong>across</strong> tags</p>';

      const matches = findMatches(container, 'Search across');
      expect(matches).toHaveLength(2);
      expect(matches[0].index).toBe(0);
      expect(matches[1].index).toBe(1);
      expect(matches[0].text).toBe('Search across');
      expect(matches[1].text).toBe('Search across');
    });

    it('supports case-insensitive and case-sensitive cross-node search', () => {
      container.innerHTML = '<p>Search <strong>ACROSS</strong> tags</p>';

      // Case-insensitive (default)
      const matchesCI = findMatches(container, 'search across');
      expect(matchesCI).toHaveLength(1);
      expect(matchesCI[0].text).toBe('Search ACROSS');

      // Case-sensitive disabled
      const matchesCSFail = findMatches(container, 'search across', { caseSensitive: true });
      expect(matchesCSFail).toHaveLength(0);

      // Case-sensitive match
      const matchesCSPass = findMatches(container, 'Search ACROSS', { caseSensitive: true });
      expect(matchesCSPass).toHaveLength(1);
      expect(matchesCSPass[0].text).toBe('Search ACROSS');
    });
  });

  describe('applyHighlights & clearHighlights Multi-Node Ranges', () => {
    it('highlights "Search across" and "across tags" without throwing DOM exceptions', () => {
      container.innerHTML = '<p>Search <strong>across</strong> tags</p>';
      const originalText = container.textContent;

      // 1. Highlight "Search across"
      const matches1 = findMatches(container, 'Search across');
      expect(() => {
        applyHighlights(container, matches1, 0);
      }).not.toThrow();

      const marks1 = container.querySelectorAll('mark[data-search-match="true"]');
      expect(marks1.length).toBeGreaterThan(0);
      expect(container.textContent).toBe(originalText);
      expect(marks1[0].classList.contains('active')).toBe(true);
      expect(marks1[0].classList.contains('search-match')).toBe(true);

      // Clear highlights
      clearHighlights(container);
      expect(container.querySelectorAll('mark').length).toBe(0);
      expect(container.textContent).toBe(originalText);

      // 2. Highlight "across tags"
      const matches2 = findMatches(container, 'across tags');
      expect(() => {
        applyHighlights(container, matches2, 0);
      }).not.toThrow();

      const marks2 = container.querySelectorAll('mark[data-search-match="true"]');
      expect(marks2.length).toBeGreaterThan(0);
      expect(container.textContent).toBe(originalText);

      // Clear highlights
      clearHighlights(container);
      expect(container.querySelectorAll('mark').length).toBe(0);
      expect(container.textContent).toBe(originalText);
    });

    it('clearing search restores original DOM structure perfectly without leaving empty tags', () => {
      container.innerHTML = '<p>Search <strong>across</strong> tags</p>';
      const originalHTML = container.innerHTML;

      const matches = findMatches(container, 'Search across');
      applyHighlights(container, matches, 0);

      // Confirm marks are injected
      expect(container.querySelectorAll('mark').length).toBeGreaterThan(0);

      // Clear highlights
      clearHighlights(container);

      // Confirm marks are removed
      expect(container.querySelectorAll('mark').length).toBe(0);

      // Confirm no empty tags left behind
      const emptyElements = Array.from(container.querySelectorAll('*')).filter(
        (el) => el.textContent === '' && el.childNodes.length === 0
      );
      expect(emptyElements).toHaveLength(0);

      // Confirm exact HTML and text node restoration
      expect(container.innerHTML).toBe(originalHTML);
      const p = container.querySelector('p');
      expect(p?.childNodes.length).toBe(3); // "Search ", <strong>across</strong>, " tags"
    });

    it('highlights and restores nested inline formatting across multiple elements', () => {
      container.innerHTML =
        '<p>Here is <em>italic</em>, <strong>bold</strong>, and <code>code</code> in one sentence.</p>';
      const originalHTML = container.innerHTML;

      const matches = findMatches(container, 'italic, bold, and code');
      expect(matches).toHaveLength(1);

      expect(() => {
        applyHighlights(container, matches, 0);
      }).not.toThrow();

      const marks = container.querySelectorAll('mark[data-search-match="true"]');
      expect(marks.length).toBeGreaterThan(0);
      expect(container.textContent).toBe(
        'Here is italic, bold, and code in one sentence.'
      );

      clearHighlights(container);
      expect(container.querySelectorAll('mark').length).toBe(0);
      expect(container.innerHTML).toBe(originalHTML);
    });

    it('handles Persian RTL cross-node matching and restoration cleanly', () => {
      container.innerHTML = '<p dir="rtl">این یک <strong>متن آزمایشی</strong> برای تست است.</p>';
      const originalHTML = container.innerHTML;

      const matches = findMatches(container, 'یک متن');
      expect(matches).toHaveLength(1);

      expect(() => {
        applyHighlights(container, matches, 0);
      }).not.toThrow();

      const marks = container.querySelectorAll('mark[data-search-match="true"]');
      expect(marks.length).toBeGreaterThan(0);

      clearHighlights(container);
      expect(container.querySelectorAll('mark').length).toBe(0);
      expect(container.innerHTML).toBe(originalHTML);
    });

    it('highlights English word inside Persian RTL paragraph with bidi isolation and single normalized mark element', () => {
      container.innerHTML = '<p dir="rtl">شاخه main می‌شوند</p>';
      const originalHTML = container.innerHTML;

      const matches = findMatches(container, 'main');
      expect(matches).toHaveLength(1);
      expect(matches[0].text).toBe('main');

      applyHighlights(container, matches, 0);

      // Verify there is EXACTLY ONE <mark class="search-match"> wrapping "main"
      const marks = container.querySelectorAll<HTMLElement>('mark.search-match');
      expect(marks).toHaveLength(1);

      const mark = marks[0];
      // Assert exact text "main"
      expect(mark.textContent).toBe('main');

      // Assert text inside <mark> is normalized to a single text node
      expect(mark.childNodes.length).toBe(1);
      expect(mark.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
      expect(mark.childNodes[0].nodeValue).toBe('main');

      // Assert pure LTR English word has dir="ltr" to prevent bidi character reversal
      expect(mark.getAttribute('dir')).toBe('ltr');

      // Assert CSS classes and active state
      expect(mark.classList.contains('search-match')).toBe(true);
      expect(mark.classList.contains('active')).toBe(true);

      // Assert inline CSS properties
      expect(mark.style.display).toBe('inline');
      expect(mark.style.direction).toBe('ltr');
      expect(mark.style.unicodeBidi).toBe('isolate');

      // Assert surrounding Persian text is preserved in natural order
      expect(container.textContent).toBe('شاخه main می‌شوند');
      expect(mark.previousSibling?.textContent).toBe('شاخه ');
      expect(mark.nextSibling?.textContent).toBe(' می‌شوند');

      // Clear highlights and verify restoration
      clearHighlights(container);
      expect(container.querySelectorAll('mark')).toHaveLength(0);
      expect(container.innerHTML).toBe(originalHTML);
    });

    it('accurately calculates offsets and highlights English word in Persian sentence without splitting or reversing', () => {
      container.innerHTML = '<p dir="rtl">تغییرات مستقیما روی شاخه main میشوند.</p>';
      const p = container.querySelector('p')!;

      const matches = findMatches(container, 'main');
      expect(matches).toHaveLength(1);
      const match = matches[0];

      // Console log startOffset and endOffset as requested
      console.log(`[search] match "${match.text}": startOffset=${match.startOffset}, endOffset=${match.endOffset}`);

      // Offset calculation assertions: "تغییرات مستقیما روی شاخه " is 25 chars
      expect(match.startOffset).toBe(25);
      expect(match.endOffset).toBe(29);
      expect(match.text).toBe('main');

      // Highlight with activeIndex = 0
      applyHighlights(container, matches, 0);

      const marks = container.querySelectorAll<HTMLElement>('mark.search-match');
      expect(marks).toHaveLength(1);
      const mark = marks[0];

      // Assert that the text inside <mark> is exactly "main"
      expect(mark.textContent).toBe('main');
      expect(mark.childNodes.length).toBe(1);
      expect(mark.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
      expect(mark.childNodes[0].nodeValue).toBe('main');

      // Assert that mark.getAttribute('dir') === 'ltr'
      expect(mark.getAttribute('dir')).toBe('ltr');

      // Assert that mark.style.direction === 'ltr'
      expect(mark.style.direction).toBe('ltr');
      expect(mark.style.unicodeBidi).toBe('isolate');

      // Assert that the DOM is EXACTLY:
      // <p dir="rtl">تغییرات مستقیما روی شاخه <mark class="search-match..." dir="ltr">main</mark> میشوند.</p>
      // (Notice the space before and after the mark).
      expect(p.childNodes.length).toBe(3);
      expect(p.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
      expect(p.childNodes[0].nodeValue).toBe('تغییرات مستقیما روی شاخه ');
      expect(p.childNodes[1]).toBe(mark);
      expect(p.childNodes[2].nodeType).toBe(Node.TEXT_NODE);
      expect(p.childNodes[2].nodeValue).toBe(' میشوند.');

      // Assert that the text node "شاخه " is untouched
      expect(p.childNodes[0].nodeValue?.endsWith('شاخه ')).toBe(true);
      expect(mark.previousSibling?.textContent).toBe('تغییرات مستقیما روی شاخه ');
      expect(mark.nextSibling?.textContent).toBe(' میشوند.');

      // Clear highlights and verify clean restoration
      clearHighlights(container);
      expect(container.querySelectorAll('mark')).toHaveLength(0);
      expect(container.innerHTML).toBe('<p dir="rtl">تغییرات مستقیما روی شاخه main میشوند.</p>');
    });

    it('calculates correct startOffset and endOffset for "شاخه main "', () => {
      container.innerHTML = '<p>شاخه main </p>';
      const matches = findMatches(container, 'main');
      expect(matches).toHaveLength(1);
      console.log(`[search] match "${matches[0].text}": startOffset=${matches[0].startOffset}, endOffset=${matches[0].endOffset}`);
      // Index of 'm' in "شاخه main " is 5
      expect(matches[0].startOffset).toBe(5);
      expect(matches[0].endOffset).toBe(9);
      expect(matches[0].text).toBe('main');
    });

    it('accurately highlights "mai" in "<p dir=\"rtl\">تغییرات روی شاخه main میشوند</p>" leaving text outside mark untouched', () => {
      const testContainer = document.createElement('div');
      testContainer.innerHTML = `<p dir="rtl">تغییرات روی شاخه main میشوند</p>`;
      const p = testContainer.querySelector('p')!;

      // search for "mai"
      const matches = findMatches(testContainer, 'mai');
      expect(matches).toHaveLength(1);
      const match = matches[0];

      // Exact offset math: "تغییرات روی شاخه " has length 17
      expect(match.startOffset).toBe(17);
      expect(match.endOffset).toBe(20);
      expect(match.text).toBe('mai');

      applyHighlights(testContainer, matches, 0);

      const mark = p.querySelector('mark')!;
      expect(mark).toBeDefined();

      // assert that the DOM is EXACTLY:
      // <p dir="rtl">تغییرات روی شاخه <mark class="search-match" dir="ltr">mai</mark>n میشوند</p>
      expect(p.childNodes.length).toBe(3);
      expect(p.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
      expect(p.childNodes[0].nodeValue).toBe('تغییرات روی شاخه ');
      expect(p.childNodes[1]).toBe(mark);
      expect(mark.tagName).toBe('MARK');
      expect(mark.classList.contains('search-match')).toBe(true);
      expect(mark.getAttribute('dir')).toBe('ltr');
      expect(mark.textContent).toBe('mai');
      expect(p.childNodes[2].nodeType).toBe(Node.TEXT_NODE);
      expect(p.childNodes[2].nodeValue).toBe('n میشوند');

      // The text outside the <mark> must remain untouched
      expect(mark.previousSibling?.textContent).toBe('تغییرات روی شاخه ');
      expect(mark.nextSibling?.textContent).toBe('n میشوند');
      expect(testContainer.textContent).toBe('تغییرات روی شاخه main میشوند');

      clearHighlights(testContainer);
      expect(testContainer.querySelectorAll('mark')).toHaveLength(0);
      expect(testContainer.innerHTML).toBe('<p dir="rtl">تغییرات روی شاخه main میشوند</p>');
    });

    it('normalizes and highlights English word when text node was previously split in RTL paragraph', () => {
      // Simulate previously split text nodes: "شاخه ma" and "in میشوند"
      const p = document.createElement('p');
      p.setAttribute('dir', 'rtl');
      const textNode1 = document.createTextNode('شاخه ma');
      const textNode2 = document.createTextNode('in میشوند');
      p.appendChild(textNode1);
      p.appendChild(textNode2);
      container.appendChild(p);

      const matches = findMatches(container, 'main');
      expect(matches).toHaveLength(1);
      expect(matches[0].startNode).toBe(textNode1);
      expect(matches[0].endNode).toBe(textNode2);

      applyHighlights(container, matches, 0);

      // Must result in exactly ONE mark element
      const marks = container.querySelectorAll<HTMLElement>('mark.search-match');
      expect(marks).toHaveLength(1);

      const mark = marks[0];
      expect(mark.textContent).toBe('main');

      // Must normalize child nodes into a SINGLE text node
      expect(mark.childNodes.length).toBe(1);
      expect(mark.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
      expect(mark.childNodes[0].nodeValue).toBe('main');
      expect(mark.getAttribute('dir')).toBe('ltr');
      expect(mark.style.unicodeBidi).toBe('isolate');
      expect(mark.style.direction).toBe('ltr');

      clearHighlights(container);
      expect(container.querySelectorAll('mark')).toHaveLength(0);
      expect(container.textContent).toBe('شاخه main میشوند');
    });

    it('verifies search.css enforces unicode-bidi: isolate and direction: ltr without direction: inherit', () => {
      const cssPath = path.resolve(__dirname, 'search.css');
      const css = fs.readFileSync(cssPath, 'utf-8');

      // Check .search-match rule has unicode-bidi: isolate, display: inline, and direction: ltr
      expect(css).toMatch(/\.search-match[^\{]*\{[^}]*unicode-bidi:\s*isolate;/);
      expect(css).toMatch(/\.search-match[^\{]*\{[^}]*display:\s*inline;/);
      expect(css).toMatch(/\.search-match[^\{]*\{[^}]*direction:\s*ltr;/);
      // Crucial: Must NOT contain direction: inherit
      expect(css).not.toMatch(/\.search-match[^\{]*\{[^}]*direction:\s*inherit;/);

      // Check explicit LTR direction rules
      expect(css).toMatch(/\.search-match\[dir="ltr"\][^\{]*\{[^}]*direction:\s*ltr;/);

      // Check active rule has direction: ltr and unicode-bidi: isolate
      expect(css).toMatch(/\.search-match\.active[^\{]*\{[^}]*unicode-bidi:\s*isolate;/);
      expect(css).toMatch(/\.search-match\.active[^\{]*\{[^}]*display:\s*inline;/);
      expect(css).toMatch(/\.search-match\.active[^\{]*\{[^}]*direction:\s*ltr;/);
      expect(css).not.toMatch(/\.search-match\.active[^\{]*\{[^}]*direction:\s*inherit;/);
    });

    it('handles search across pre-existing highlights by clearing previous highlights first', () => {
      // Suppose previous search left an active mark on "in": "شاخه ma<mark>in</mark> میشوند"
      container.innerHTML =
        '<p dir="rtl">شاخه ma<mark class="search-match active" data-search-match="true">in</mark> میشوند</p>';

      clearHighlights(container);
      const matches = findMatches(container, 'main');
      expect(matches).toHaveLength(1);

      applyHighlights(container, matches, 0);

      const marks = container.querySelectorAll<HTMLElement>('mark.search-match');
      // Must be EXACTLY ONE mark, never nested or multiple
      expect(marks).toHaveLength(1);
      const mark = marks[0];
      expect(mark.textContent).toBe('main');
      expect(mark.childNodes.length).toBe(1);
      expect(mark.getAttribute('dir')).toBe('ltr');
      expect(mark.style.direction).toBe('ltr');
      expect(mark.classList.contains('active')).toBe(true);
      expect(mark.querySelectorAll('mark')).toHaveLength(0);
    });
  });

  describe('useSearch Hook with Cross-Node Queries', () => {
    const TestComponent: React.FC = () => {
      const docRef = useRef<HTMLDivElement>(null);
      const search = useSearch({ containerRef: docRef, initialOpen: true });

      return (
        <div>
          <div ref={docRef} data-testid="doc-container">
            <p>Search <strong>across</strong> tags in document</p>
            <p>Second paragraph with Search <strong>across</strong> tags</p>
          </div>
          <div data-testid="controls">
            <span data-testid="match-count">{search.totalMatches}</span>
            <span data-testid="current-index">{search.currentIndex}</span>
            <button onClick={() => search.setQuery('Search across')} data-testid="btn-query">
              Query
            </button>
            <button onClick={search.nextMatch} data-testid="btn-next">
              Next
            </button>
            <button onClick={search.prevMatch} data-testid="btn-prev">
              Prev
            </button>
            <button onClick={search.closeSearch} data-testid="btn-close">
              Close
            </button>
          </div>
        </div>
      );
    };

    it('navigates next and previous matches with cross-node highlights', () => {
      render(<TestComponent />);

      // Search for "Search across"
      act(() => {
        fireEvent.click(screen.getByTestId('btn-query'));
      });

      expect(screen.getByTestId('match-count')).toHaveTextContent('2');
      expect(screen.getByTestId('current-index')).toHaveTextContent('0');

      const marks = screen.getByTestId('doc-container').querySelectorAll('mark[data-search-match="true"]');
      expect(marks.length).toBe(2);
      expect(marks[0].classList.contains('active')).toBe(true);
      expect(marks[1].classList.contains('active')).toBe(false);

      // Next match
      act(() => {
        fireEvent.click(screen.getByTestId('btn-next'));
      });
      expect(screen.getByTestId('current-index')).toHaveTextContent('1');
      expect(marks[0].classList.contains('active')).toBe(false);
      expect(marks[1].classList.contains('active')).toBe(true);

      // Previous match
      act(() => {
        fireEvent.click(screen.getByTestId('btn-prev'));
      });
      expect(screen.getByTestId('current-index')).toHaveTextContent('0');
      expect(marks[0].classList.contains('active')).toBe(true);
      expect(marks[1].classList.contains('active')).toBe(false);

      // Close search cleans up
      act(() => {
        fireEvent.click(screen.getByTestId('btn-close'));
      });
      expect(
        screen.getByTestId('doc-container').querySelectorAll('mark[data-search-match="true"]').length
      ).toBe(0);
    });
  });

  describe('MarkdownViewer Full Component Integration with Cross-Node Markdown', () => {
    it('finds and highlights "Search across" and "across tags" rendered from markdown', () => {
      const markdown = `
# Cross-Node Search Test Document

Search **across** tags in markdown.

Another paragraph with **across** tags highlighted.
`;

      render(
        <MarkdownViewer
          document={{
            filename: 'cross-node.md',
            filePath: '/test/cross-node.md',
            content: markdown,
          }}
        />
      );

      // Open search bar
      fireEvent.click(screen.getByTestId('doc-search-toggle'));
      const input = screen.getByTestId('search-input') as HTMLInputElement;

      // 1. Search for "Search across"
      act(() => {
        fireEvent.change(input, { target: { value: 'Search across' } });
      });

      expect(screen.getByTestId('search-counter')).toHaveTextContent('1 of 1');
      const marks1 = screen
        .getByTestId('markdown-content')
        .querySelectorAll('mark[data-search-match="true"]');
      expect(marks1.length).toBe(1);
      expect(marks1[0].classList.contains('active')).toBe(true);

      // 2. Search for "across tags"
      act(() => {
        fireEvent.change(input, { target: { value: 'across tags' } });
      });

      expect(screen.getByTestId('search-counter')).toHaveTextContent('1 of 2');
      const marks2 = screen
        .getByTestId('markdown-content')
        .querySelectorAll('mark[data-search-match="true"]');
      expect(marks2.length).toBe(2);

      // Press Enter to cycle to second match
      act(() => {
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
      });
      expect(screen.getByTestId('search-counter')).toHaveTextContent('2 of 2');

      // Close search with Escape
      act(() => {
        fireEvent.keyDown(input, { key: 'Escape' });
      });
      expect(screen.queryByTestId('search-bar')).not.toBeInTheDocument();
      expect(
        screen.getByTestId('markdown-content').querySelectorAll('mark[data-search-match="true"]').length
      ).toBe(0);
    });

    it('finds and highlights English word in Persian RTL paragraph rendered via MarkdownViewer with correct mark and bidi isolation', () => {
      const markdown = `
# سند تست

شاخه main میشوند
`;

      render(
        <MarkdownViewer
          document={{
            filename: 'rtl-bidi.md',
            filePath: '/test/rtl-bidi.md',
            content: markdown,
          }}
        />
      );

      // Open search bar
      fireEvent.click(screen.getByTestId('doc-search-toggle'));
      const input = screen.getByTestId('search-input') as HTMLInputElement;

      act(() => {
        fireEvent.change(input, { target: { value: 'main' } });
      });

      expect(screen.getByTestId('search-counter')).toHaveTextContent('1 of 1');
      const marks = screen
        .getByTestId('markdown-content')
        .querySelectorAll<HTMLElement>('mark.search-match');
      expect(marks.length).toBe(1);
      expect(marks[0].textContent).toBe('main');
      expect(marks[0].childNodes.length).toBe(1);
      expect(marks[0].childNodes[0].nodeType).toBe(Node.TEXT_NODE);
      expect(marks[0].getAttribute('dir')).toBe('ltr');
      expect(marks[0].style.unicodeBidi).toBe('isolate');
      expect(marks[0].style.display).toBe('inline');
      expect(marks[0].style.direction).toBe('ltr');
    });
  });
});
