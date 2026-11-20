import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarkdownViewer } from '../rendering/MarkdownViewer';
import { defaultToastStore } from '../notifications';
import { zoomController } from '../viewport/zoomController';

describe('Table of Contents Click Navigation & Native Scroll Alignment', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    localStorage.clear();
    zoomController.resetZoom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.matchMedia = originalMatchMedia;
    localStorage.clear();
    zoomController.resetZoom();
  });

    it('scrolls document target into view with scrollIntoView behavior and synchronizes active outline state', () => {
      const markdown = `
# Getting Started

Welcome to the guide.

## Installation

Run the installer.

## Configuration

Set options.
`;

      render(
        <MarkdownViewer
          document={{ filename: 'guide.md', content: markdown }}
          showToc={true}
        />
      );

      const installLink = screen.getByTestId('toc-link-installation');
      expect(installLink).toBeInTheDocument();
      expect(installLink).not.toHaveClass('active');

      const installHeading = document.getElementById('installation')!;
      expect(installHeading).not.toBeNull();
      installHeading.scrollIntoView = vi.fn();
      const scrollSpy = vi.spyOn(installHeading, 'scrollIntoView');

      // Click Installation outline link
      fireEvent.click(installLink);

      // Verify target scrollIntoView called with smooth behavior and start block
      expect(scrollSpy).toHaveBeenCalledTimes(1);
      expect(scrollSpy).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });

      // Verify active class immediately updated
      expect(installLink).toHaveClass('active');
      expect(installLink).toHaveAttribute('aria-current', 'location');
    });

      it('invokes scrollIntoView reliably across different zoom levels', () => {
        const markdown = `
# Introduction

Paragraph.

## Deep Section

Deep content.
`;

        zoomController.setZoom(150);

        const { unmount } = render(
          <MarkdownViewer
            document={{ filename: 'zoom-test.md', content: markdown }}
            showToc={true}
          />
        );

        const deepHeading = document.getElementById('deep-section')!;
        deepHeading.scrollIntoView = vi.fn();
        const scrollSpy = vi.spyOn(deepHeading, 'scrollIntoView');

        const deepLink = screen.getByTestId('toc-link-deep-section');
        fireEvent.click(deepLink);

        expect(scrollSpy).toHaveBeenCalledTimes(1);
        expect(scrollSpy).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'start',
        });

        unmount();

        // Zoom test at 75%
        zoomController.setZoom(75);

        render(
          <MarkdownViewer
            document={{ filename: 'zoom-test-2.md', content: markdown }}
            showToc={true}
          />
        );

        const deepHeading75 = document.getElementById('deep-section')!;
        deepHeading75.scrollIntoView = vi.fn();
        const scrollSpy75 = vi.spyOn(deepHeading75, 'scrollIntoView');

        const deepLink75 = screen.getByTestId('toc-link-deep-section');
        fireEvent.click(deepLink75);

        expect(scrollSpy75).toHaveBeenCalledTimes(1);
        expect(scrollSpy75).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'start',
        });
      });

      it('respects prefers-reduced-motion with behavior auto', () => {
        window.matchMedia = vi.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        const markdown = `# Title\n\n## Next`;
        render(<MarkdownViewer document={{ filename: 'motion.md', content: markdown }} showToc={true} />);

        const nextHeading = document.getElementById('next')!;
        nextHeading.scrollIntoView = vi.fn();
        const scrollSpy = vi.spyOn(nextHeading, 'scrollIntoView');

        fireEvent.click(screen.getByTestId('toc-link-next'));

        expect(scrollSpy).toHaveBeenCalledWith({
          behavior: 'auto',
          block: 'start',
        });
      });

      it('triggers diagnostic toast notification when localStorage.debugOutline is enabled', async () => {
        localStorage.setItem('debugOutline', '1');
        const toastSpy = vi.spyOn(defaultToastStore, 'showInfo');

        const markdown = `# Title\n\n## Section One`;
        render(<MarkdownViewer document={{ filename: 'diag.md', content: markdown }} showToc={true} />);

        const sectionHeading = document.getElementById('section-one')!;
        sectionHeading.scrollIntoView = vi.fn();

        fireEvent.click(screen.getByTestId('toc-link-section-one'));

        await waitFor(() => {
          expect(toastSpy).toHaveBeenCalledTimes(1);
          expect(toastSpy.mock.calls[0][0]).toContain('[Outline Debug]');
          expect(toastSpy.mock.calls[0][0]).toContain('Target: "section-one"');
          expect(toastSpy.mock.calls[0][0]).toContain('scrollIntoView dispatched');
        });
      });

        it('ensures target heading is strictly contained in .markdown-content and not .markdown-viewport directly', () => {
          const markdown = `# Title\n\n## Custom Offset Heading`;
          render(<MarkdownViewer document={{ filename: 'offset.md', content: markdown }} showToc={true} />);

          const targetHeading = document.getElementById('custom-offset-heading')!;
          targetHeading.scrollIntoView = vi.fn();
          const scrollSpy = vi.spyOn(targetHeading, 'scrollIntoView');

          const contentScroller = screen.getByTestId('markdown-content');
          expect(contentScroller).toBeInTheDocument();
          expect(contentScroller.contains(targetHeading)).toBe(true);

          fireEvent.click(screen.getByTestId('toc-link-custom-offset-heading'));

            expect(scrollSpy).toHaveBeenCalledWith({
              behavior: 'smooth',
              block: 'start',
            });
          });
        });
