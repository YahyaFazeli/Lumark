import React, { useRef } from 'react';
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
      expect(marks1[0].classList.contains('search-highlight')).toBe(true);

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
  });
});
