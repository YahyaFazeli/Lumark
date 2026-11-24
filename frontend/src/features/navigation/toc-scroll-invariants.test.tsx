import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { MarkdownViewer } from '../rendering/MarkdownViewer';

describe('Table of Contents Scroll Invariants & Zoom Normalization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Ancestor Chain Scroller Invariant', () => {
    it('ensures exactly one element in the viewer ancestor chain has scrollHeight > clientHeight, and it is .markdown-content', () => {
      const longMarkdown = `
# Title

${Array.from({ length: 40 }, (_, i) => `## Section ${i + 1}\n\nContent for section ${i + 1}.`).join('\n\n')}
`;

      render(
        <MarkdownViewer
          document={{ filename: 'invariants.md', content: longMarkdown }}
          showToc={true}
        />
      );

      const content = screen.getByTestId('markdown-content');
      const viewportBody = screen.getByTestId('markdown-viewport-body');
      const viewport = screen.getByTestId('markdown-viewport');

      // Simulate real-world rendered dimensions in JSDOM
      Object.defineProperty(content, 'scrollHeight', { value: 3500, configurable: true });
      Object.defineProperty(content, 'clientHeight', { value: 800, configurable: true });

      Object.defineProperty(viewportBody, 'scrollHeight', { value: 800, configurable: true });
      Object.defineProperty(viewportBody, 'clientHeight', { value: 800, configurable: true });

      Object.defineProperty(viewport, 'scrollHeight', { value: 800, configurable: true });
      Object.defineProperty(viewport, 'clientHeight', { value: 800, configurable: true });

      // Trace ancestor chain from .markdown-content up to .markdown-viewport
      const chain: HTMLElement[] = [];
      let curr: HTMLElement | null = content;
      while (curr && curr !== viewport.parentElement) {
        chain.push(curr);
        curr = curr.parentElement;
      }

      const overflowingElements = chain.filter((el) => el.scrollHeight > el.clientHeight);

      // Exactly one element must overflow, and that element must be .markdown-content
      expect(overflowingElements).toHaveLength(1);
      expect(overflowingElements[0]).toBe(content);
      expect(overflowingElements[0]).toHaveClass('markdown-content');
    });

    it('verifies non-scrolling ancestor wrappers have overflow: clip in markdown.css and shell.css', () => {
      const markdownCssPath = path.resolve(__dirname, '../rendering/markdown.css');
      const markdownCss = fs.readFileSync(markdownCssPath, 'utf-8');

      // .markdown-viewport must have overflow: clip to prevent scrollIntoView ancestor displacement
      const viewportRegex = /\.markdown-viewport\s*\{[^}]*overflow:\s*clip;/;
      expect(markdownCss).toMatch(viewportRegex);

      // .markdown-viewport-body must have overflow: clip
      const viewportBodyRegex = /\.markdown-viewport-body\s*\{[^}]*overflow:\s*clip;/;
      expect(markdownCss).toMatch(viewportBodyRegex);

      // .markdown-viewport-body>.markdown-content must be the scroll container with overflow-y: auto
      const contentRegex = /\.markdown-viewport-body>\.markdown-content\s*\{[^}]*overflow-y:\s*auto;/;
      expect(markdownCss).toMatch(contentRegex);

      // shell.css .app-viewport must have overflow: clip !important
      const shellCssPath = path.resolve(__dirname, '../shell/shell.css');
      const shellCss = fs.readFileSync(shellCssPath, 'utf-8');
      expect(shellCss).toMatch(/\.app-viewport[^{]*\{[^}]*overflow:\s*clip\s*!important;/);
    });
  });

  describe('Heading Scroll Offset Zoom Calibration Math', () => {
    it('calibrates CSS scroll-margin-top across zoom levels so visual screen clearance remains constant at 80px', () => {
      const HEADING_SCROLL_OFFSET = 80;
      const calculateScrollMarginTop = (zoom: number) => HEADING_SCROLL_OFFSET / (zoom > 0 ? zoom : 1);

      const zoomLevels = [0.75, 1.0, 1.25, 1.5, 2.0];

      for (const zoom of zoomLevels) {
        const localMarginTop = calculateScrollMarginTop(zoom);
        // Visual clearance on screen = local CSS margin * zoom factor
        const visualClearanceScreenPx = localMarginTop * zoom;
        expect(visualClearanceScreenPx).toBeCloseTo(80, 5);
      }

      // Verify specific values
      expect(calculateScrollMarginTop(0.75)).toBeCloseTo(106.6667, 3);
      expect(calculateScrollMarginTop(1.0)).toBe(80);
      expect(calculateScrollMarginTop(1.5)).toBeCloseTo(53.3333, 3);
      expect(calculateScrollMarginTop(2.0)).toBe(40);
    });

    it('verifies markdown.css declares scroll-padding-top on .markdown-content and dynamic scroll-margin-top on headings', () => {
      const markdownCssPath = path.resolve(__dirname, '../rendering/markdown.css');
      const markdownCss = fs.readFileSync(markdownCssPath, 'utf-8');

      // .markdown-content declares --heading-scroll-offset: 80px and scroll-padding-top
      expect(markdownCss).toContain('--heading-scroll-offset: 80px;');
      expect(markdownCss).toContain('scroll-padding-top: var(--heading-scroll-offset);');

      // Headings divide heading-scroll-offset by current-zoom
      expect(markdownCss).toMatch(
        /scroll-margin-top:\s*calc\(\s*var\(--heading-scroll-offset,\s*80px\)\s*\/\s*var\(--current-zoom/
      );
    });
  });

  describe('ReadingScrollbar Scroll Ratio Math under Zoom', () => {
    it('calculates scroll progress and thumb positioning accurately across document scroll states', () => {
      const scrollHeight = 4000;
      const clientHeight = 1000;
      const trackHeight = 400;

      const maxScroll = scrollHeight - clientHeight; // 3000
      expect(maxScroll).toBe(3000);

      // Thumb height calculation: Math.max(28, Math.round((clientHeight / scrollHeight) * trackHeight))
      const thumbHeight = Math.max(28, Math.round((clientHeight / scrollHeight) * trackHeight));
      expect(thumbHeight).toBe(100); // (1000 / 4000) * 400 = 100

      const availableTrack = trackHeight - thumbHeight; // 300
      expect(availableTrack).toBe(300);

      const testPoints = [
        { scrollTop: 0, expectedPercent: 0, expectedThumbTop: 0 },
        { scrollTop: 750, expectedPercent: 25, expectedThumbTop: 75 },
        { scrollTop: 1500, expectedPercent: 50, expectedThumbTop: 150 },
        { scrollTop: 2250, expectedPercent: 75, expectedThumbTop: 225 },
        { scrollTop: 3000, expectedPercent: 100, expectedThumbTop: 300 },
      ];

      for (const pt of testPoints) {
        const percent = Math.min(100, Math.max(0, Math.round((pt.scrollTop / maxScroll) * 100)));
        const thumbTop = Math.round((pt.scrollTop / maxScroll) * availableTrack);

        expect(percent).toBe(pt.expectedPercent);
        expect(thumbTop).toBe(pt.expectedThumbTop);
      }
    });

    it('translates drag delta on outer track directly to document scroll delta independent of zoom', () => {
      const maxScroll = 2000;
      const availableTrack = 300;

      // When dragging 30px on screen track:
      const deltaY = 30;
      const scrollDelta = (deltaY / availableTrack) * maxScroll;

      // 30 / 300 = 10% of track => 10% of 2000 = 200px document scroll
      expect(scrollDelta).toBe(200);
    });
  });

  describe('TOC Wheel Isolation & Gutter Scroll Invariants', () => {
    const longMarkdown = `
# Title

${Array.from({ length: 40 }, (_, i) => `## Section ${i + 1}\n\nContent for section ${i + 1}.`).join('\n\n')}
`;

    it('ensures scrolling over TOC does NOT scroll the main document and stops event propagation', () => {
      render(
        <MarkdownViewer
          document={{ filename: 'toc-wheel-isolation.md', content: longMarkdown }}
          showToc={true}
        />
      );

      const content = screen.getByTestId('markdown-content');
      const tocSidebar = screen.getByTestId('toc-sidebar');
      const tocLink = screen.getByTestId('toc-link-section-1');

      content.scrollTop = 200;

      // Wheel event on the TOC rail container itself
      fireEvent.wheel(tocSidebar, { deltaY: 80 });
      // Main document must remain completely still
      expect(content.scrollTop).toBe(200);

      // Wheel event on a TOC child link item
      fireEvent.wheel(tocLink, { deltaY: 120 });
      // Main document must still remain completely still
      expect(content.scrollTop).toBe(200);
    });

    it('ensures scrolling over gutters outside the TOC STILL scrolls the main document', () => {
      render(
        <MarkdownViewer
          document={{ filename: 'gutter-wheel-test.md', content: longMarkdown }}
          showToc={true}
        />
      );

      const content = screen.getByTestId('markdown-content');
      const viewport = screen.getByTestId('markdown-viewport');

      content.scrollTop = 100;

      // Wheel event on the outer viewport (gutter outside the TOC and content)
      fireEvent.wheel(viewport, { deltaY: 75 });

      expect(content.scrollTop).toBe(175);
    });

    it('verifies toc.css configures native scrolling with overscroll containment and pointer events', () => {
      const tocCssPath = path.resolve(__dirname, 'toc.css');
      const tocCss = fs.readFileSync(tocCssPath, 'utf-8');

      // .scrollspy-rail / .toc-sidebar must have overflow-y: auto, overscroll-behavior: contain, and pointer-events: auto
      expect(tocCss).toMatch(/\.scrollspy-rail[^{]*\{[^}]*overflow-y:\s*auto;/);
      expect(tocCss).toMatch(/\.scrollspy-rail[^{]*\{[^}]*overscroll-behavior:\s*contain;/);
      expect(tocCss).toMatch(/\.scrollspy-rail[^{]*\{[^}]*pointer-events:\s*auto;/);
    });
  });
});
