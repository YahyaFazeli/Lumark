import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import { MarkdownViewer } from '../rendering/MarkdownViewer';

describe('Viewport Scroll Container Layout Verification', () => {
  const markdownCssPath = path.resolve(__dirname, '../rendering/markdown.css');
  const markdownCss = fs.readFileSync(markdownCssPath, 'utf-8');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('CSS Rule Contracts in markdown.css', () => {
    it('ensures .markdown-viewport-body stretches child container to 100% width', () => {
      const bodyRegex = /\.markdown-viewport-body\s*\{[^}]*align-items:\s*stretch;/;
      expect(markdownCss).toMatch(bodyRegex);
      expect(markdownCss).not.toMatch(/\.markdown-viewport-body\s*\{[^}]*align-items:\s*center;/);
    });

    it('ensures .markdown-content takes 100% width and height with overflow-y: auto for full viewport wheel capture', () => {
      // Must have width: 100%, height: 100%, overflow-y: auto within the rule block
      const contentRuleMatch = markdownCss.match(/\.markdown-viewport-body>\.markdown-content\s*\{([^}]+)\}/);
      expect(contentRuleMatch).not.toBeNull();
      const contentBlock = contentRuleMatch![1];

      expect(contentBlock).toMatch(/width:\s*100%;/);
      expect(contentBlock).toMatch(/height:\s*100%;/);
      expect(contentBlock).toMatch(/overflow-y:\s*auto;/);

      // Must not constrain .markdown-content itself to max-width: 700px
      expect(contentBlock).not.toMatch(/max-width:\s*700px;/);
    });

    it('ensures .document-wrapper remains centered with max-width: 700px and margin: 0 auto', () => {
      const wrapperRuleMatch = markdownCss.match(/\.document-wrapper\s*\{([^}]+)\}/);
      expect(wrapperRuleMatch).not.toBeNull();
      const wrapperBlock = wrapperRuleMatch![1];

      expect(wrapperBlock).toMatch(/max-width:\s*700px;/);
      expect(wrapperBlock).toMatch(/margin:\s*0\s+auto;/);
    });
  });

  describe('DOM Hierarchy & Gutter Wheel Scroll Behavior', () => {
    const longMarkdown = `
# Title

${Array.from({ length: 50 }, (_, i) => `Paragraph ${i + 1} with enough content to create a scrollable document.`).join('\n\n')}
`;

    it('renders scrollable .markdown-content with full width containing centered .document-wrapper', () => {
      render(
        <MarkdownViewer
          document={{
            filename: 'scroll-test.md',
            content: longMarkdown,
          }}
        />
      );

      const scrollContainer = screen.getByTestId('markdown-content');
      expect(scrollContainer).toBeInTheDocument();
      expect(scrollContainer).toHaveClass('markdown-content');

      // The centered text container (.document-wrapper) must be inside the scroll container
      const documentWrapper = scrollContainer.querySelector('.document-wrapper');
      expect(documentWrapper).not.toBeNull();
      expect(documentWrapper).toHaveClass('document-wrapper', 'markdown-body');

      // Headings and paragraphs are rendered inside .document-wrapper
      const heading = documentWrapper?.querySelector('h1');
      expect(heading).toHaveTextContent('Title');
    });

    it('dispatches scroll events properly on .markdown-content when wheeling in gutters and text', () => {
      render(
        <MarkdownViewer
          document={{
            filename: 'scroll-test.md',
            content: longMarkdown,
          }}
        />
      );

      const scrollContainer = screen.getByTestId('markdown-content');
      const documentWrapper = scrollContainer.querySelector('.document-wrapper')!;
      expect(documentWrapper).toBeInTheDocument();

      const scrollSpy = vi.fn();
      scrollContainer.addEventListener('scroll', scrollSpy);

      // Simulate scrolling from mouse wheel over the container (e.g. left/right gutters)
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 200, writable: true, configurable: true });
      fireEvent.scroll(scrollContainer);
      expect(scrollSpy).toHaveBeenCalledTimes(1);

      // Simulate scrolling from within the text column
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 450, writable: true, configurable: true });
      fireEvent.scroll(scrollContainer);
      expect(scrollSpy).toHaveBeenCalledTimes(2);
    });
  });
});
