import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { MarkdownViewer } from '../rendering/MarkdownViewer';
import { extractHeadingsFromMarkdown } from './tocGenerator';
import { zoomController } from '../viewport/zoomController';

describe('Outline Jump Reproduction with Real AGENTS.md and PRD.md', () => {
  beforeEach(() => {
    zoomController.resetZoom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    zoomController.resetZoom();
  });

    it('verifies all TOC entries in AGENTS.md resolve to rendered heading elements and trigger scrollIntoView', () => {
      const agentsPath = path.resolve(__dirname, '../../../../AGENTS.md');
      const content = fs.readFileSync(agentsPath, 'utf-8');

      const expectedToc = extractHeadingsFromMarkdown(content);
      expect(expectedToc.length).toBeGreaterThan(0);

      render(
        <MarkdownViewer
          document={{ filename: 'AGENTS.md', filePath: agentsPath, content }}
          showToc={true}
        />
      );

      const tocList = screen.getByTestId('toc-list');
      expect(tocList).toBeInTheDocument();

      const missingInDom: string[] = [];
      const failedClicks: string[] = [];

      for (const item of expectedToc) {
        // 1. Check if heading element with target ID exists in rendered DOM
        const headingEl = document.getElementById(item.id);
        if (!headingEl) {
          missingInDom.push(item.id);
          continue;
        }

        headingEl.scrollIntoView = vi.fn();
        const scrollSpy = vi.spyOn(headingEl, 'scrollIntoView');

        // 2. Click the TOC link
        const tocLink = screen.queryByTestId(`toc-link-${item.id}`);
        if (!tocLink) {
          failedClicks.push(`TOC link not found for id: ${item.id}`);
          continue;
        }

        fireEvent.click(tocLink);

        const callArg = scrollSpy.mock.calls[0]?.[0];
        const isOptions = typeof callArg === 'object' && callArg !== null;
        if (
        scrollSpy.mock.calls.length === 0 ||
            !isOptions ||
            callArg.behavior !== 'smooth' ||
            callArg.block !== 'start'
      ) {
      failedClicks.push(
          `Click on ${item.id} failed. Calls: ${JSON.stringify(scrollSpy.mock.calls)}`
      );
    }
  }

    expect(missingInDom).toEqual([]);
  expect(failedClicks).toEqual([]);
});

  it('verifies all TOC entries in PRD.md resolve to rendered heading elements and trigger scrollIntoView', () => {
    const prdCandidates = [
      path.resolve(__dirname, '../../../../docs/PRD.md'),
      path.resolve(__dirname, '../../../../PRD.md'),
    ];
    const prdPath = prdCandidates.find((p) => fs.existsSync(p)) || prdCandidates[0];
    const content = fs.readFileSync(prdPath, 'utf-8');

    const expectedToc = extractHeadingsFromMarkdown(content);
    expect(expectedToc.length).toBeGreaterThan(0);

    render(
      <MarkdownViewer
        document={{ filename: 'PRD.md', filePath: prdPath, content }}
        showToc={true}
      />
    );

    const tocList = screen.getByTestId('toc-list');
    expect(tocList).toBeInTheDocument();

    const missingInDom: string[] = [];
    const failedClicks: string[] = [];

    for (const item of expectedToc) {
      const headingEl = document.getElementById(item.id);
      if (!headingEl) {
        missingInDom.push(item.id);
        continue;
      }
      headingEl.scrollIntoView = vi.fn();
      const scrollSpy = vi.spyOn(headingEl, 'scrollIntoView');

      const tocLink = screen.queryByTestId(`toc-link-${item.id}`);
      if (!tocLink) {
        failedClicks.push(`TOC link not found for id: ${item.id}`);
        continue;
      }

      fireEvent.click(tocLink);

      const callArg = scrollSpy.mock.calls[0]?.[0];
      const isOptions = typeof callArg === 'object' && callArg !== null;
      if (
        scrollSpy.mock.calls.length === 0 ||
          !isOptions ||
          callArg.behavior !== 'smooth' ||
          callArg.block !== 'start'
      ) {
    failedClicks.push(
        `Click on ${item.id} failed. Calls: ${JSON.stringify(scrollSpy.mock.calls)}`
    );
  }
}

    expect(missingInDom).toEqual([]);
expect(failedClicks).toEqual([]);
  }, 25000);
});
