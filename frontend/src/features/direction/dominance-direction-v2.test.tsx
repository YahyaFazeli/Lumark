import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  getTextDirection,
  applyDominanceDirection,
} from './autoDirection';
import { MarkdownViewer } from '../rendering/MarkdownViewer';

describe('Dominance-Based Bidi Alignment Suite (v2)', () => {
  describe('1. Mandatory Test Cases (Tasks 1 & 3)', () => {
    it('Case 1 (RTL Doc, Mostly Persian): resolves to "rtl"', () => {
      const text = '🚨 Phase 3؟ چه زمانی مردود است؟';
      expect(getTextDirection(text, 'rtl')).toBe('rtl');
    });

    it('Case 2 (RTL Doc, Mostly English): resolves to "ltr"', () => {
      const text = 'This is a long English paragraph with one کلمه.';
      expect(getTextDirection(text, 'rtl')).toBe('ltr');
    });

    it('Case 3 (RTL Doc, Short English Prefix): resolves to "rtl"', () => {
      const text = '8. Phase 6 — Git Provider Integration';
      expect(getTextDirection(text, 'rtl')).toBe('rtl');
    });

    it('Case 4 (RTL Doc, Bullet Point): resolves to "rtl"', () => {
      const text = '○ Git Commit و Push';
      expect(getTextDirection(text, 'rtl')).toBe('rtl');
    });

    it('Case 5 (RTL Doc, Only Numbers): resolves to "rtl" (fallback to document direction)', () => {
      const text = '12345';
      expect(getTextDirection(text, 'rtl')).toBe('rtl');
    });

    it('Case 6 (LTR Doc, Mostly English): resolves to "ltr"', () => {
      const text = 'This is a test with one کلمه.';
      expect(getTextDirection(text, 'ltr')).toBe('ltr');
    });
  });

  describe('2. Block-Level DOM Sweep & Strict Pre/Code Exclusion (Task 2)', () => {
    it('applies dir and style="text-align" to <p>, <h1>-<h6>, <li>, <blockquote>, <td>, <th>', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <h1 id="case3-h1">8. Phase 6 — Git Provider Integration</h1>
        <p id="case1-p">🚨 Phase 3؟ چه زمانی مردود است؟</p>
        <p id="case2-p">This is a long English paragraph with one کلمه.</p>
        <ul>
          <li id="case4-li">○ Git Commit و Push</li>
          <li id="case5-li">12345</li>
        </ul>
        <blockquote id="bq">این یک نقل قول به زبان فارسی است.</blockquote>
        <table>
          <thead>
            <tr>
              <th id="th1">عنوان ستون فارسی</th>
              <th id="th2">Column Header</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td id="td1">داده اول</td>
              <td id="td2">Cell Data</td>
            </tr>
          </tbody>
        </table>
      `;

      applyDominanceDirection(container, 'rtl');

      // Case 3 in heading
      const h1 = container.querySelector('#case3-h1') as HTMLElement;
      expect(h1.getAttribute('dir')).toBe('rtl');
      expect(h1.style.textAlign).toBe('right');

      // Case 1 in paragraph
      const p1 = container.querySelector('#case1-p') as HTMLElement;
      expect(p1.getAttribute('dir')).toBe('rtl');
      expect(p1.style.textAlign).toBe('right');

      // Case 2 in paragraph
      const p2 = container.querySelector('#case2-p') as HTMLElement;
      expect(p2.getAttribute('dir')).toBe('ltr');
      expect(p2.style.textAlign).toBe('left');

      // Case 4 in list item
      const li1 = container.querySelector('#case4-li') as HTMLElement;
      expect(li1.getAttribute('dir')).toBe('rtl');
      expect(li1.style.textAlign).toBe('right');

      // Case 5 in list item (numbers only in RTL doc)
      const li2 = container.querySelector('#case5-li') as HTMLElement;
      expect(li2.getAttribute('dir')).toBe('rtl');
      expect(li2.style.textAlign).toBe('right');

      // Blockquote
      const bq = container.querySelector('#bq') as HTMLElement;
      expect(bq.getAttribute('dir')).toBe('rtl');
      expect(bq.style.textAlign).toBe('right');

      // Table cells & headers
      const th1 = container.querySelector('#th1') as HTMLElement;
      expect(th1.getAttribute('dir')).toBe('rtl');
      expect(th1.style.textAlign).toBe('right');

      const th2 = container.querySelector('#th2') as HTMLElement;
      expect(th2.getAttribute('dir')).toBe('ltr');
      expect(th2.style.textAlign).toBe('left');

      const td1 = container.querySelector('#td1') as HTMLElement;
      expect(td1.getAttribute('dir')).toBe('rtl');
      expect(td1.style.textAlign).toBe('right');

      const td2 = container.querySelector('#td2') as HTMLElement;
      expect(td2.getAttribute('dir')).toBe('ltr');
      expect(td2.style.textAlign).toBe('left');
    });

    it('strictly excludes <pre> and <code> elements, preserving dir="ltr"', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <h2 id="heading">8. Phase 6 — Git Provider Integration</h2>
        <pre id="pre-block" dir="ltr"><code id="code-block" dir="ltr">const git = require('git-provider');\nconsole.log(git.status());</code></pre>
        <p id="inline-code-p">دستور <code id="inline-code" dir="ltr">git push origin main</code> را اجرا کنید.</p>
      `;

      applyDominanceDirection(container, 'rtl');

      // Heading gets rtl in RTL doc
      const h2 = container.querySelector('#heading') as HTMLElement;
      expect(h2.getAttribute('dir')).toBe('rtl');
      expect(h2.style.textAlign).toBe('right');

      // Paragraph gets rtl
      const p = container.querySelector('#inline-code-p') as HTMLElement;
      expect(p.getAttribute('dir')).toBe('rtl');
      expect(p.style.textAlign).toBe('right');

      // <pre> and <code> MUST strictly remain dir="ltr"
      const pre = container.querySelector('#pre-block') as HTMLElement;
      expect(pre.getAttribute('dir')).toBe('ltr');
      expect(pre.style.textAlign).not.toBe('right');

      const codeBlock = container.querySelector('#code-block') as HTMLElement;
      expect(codeBlock.getAttribute('dir')).toBe('ltr');
      expect(codeBlock.style.textAlign).not.toBe('right');

      const inlineCode = container.querySelector('#inline-code') as HTMLElement;
      expect(inlineCode.getAttribute('dir')).toBe('ltr');
      expect(inlineCode.style.textAlign).not.toBe('right');
    });
  });

  describe('3. MarkdownViewer End-to-End Rendering Verification', () => {
    it('renders all mandatory cases inside MarkdownViewer with dominanceBidi={true}', () => {
      const markdown = `
# 8. Phase 6 — Git Provider Integration

🚨 Phase 3؟ چه زمانی مردود است؟

This is a long English paragraph with one کلمه.

- ○ Git Commit و Push
- 12345

\`\`\`typescript
const status = "clean";
\`\`\`
      `;

      const { container } = render(
        <MarkdownViewer
          content={markdown}
          directionPreference="rtl"
          dominanceBidi={true}
        />
      );

      // 1. Heading (Case 3 in RTL doc)
      const h1 = container.querySelector('h1') as HTMLElement;
      expect(h1).toHaveAttribute('dir', 'rtl');
      expect(h1.style.textAlign).toBe('right');

      // 2. Paragraphs
      const paragraphs = Array.from(container.querySelectorAll('p')) as HTMLElement[];
      expect(paragraphs.length).toBe(2);

      // Case 1: Mostly Persian
      expect(paragraphs[0]).toHaveAttribute('dir', 'rtl');
      expect(paragraphs[0].style.textAlign).toBe('right');

      // Case 2: Mostly English
      expect(paragraphs[1]).toHaveAttribute('dir', 'ltr');
      expect(paragraphs[1].style.textAlign).toBe('left');

      // 3. List items
      const listItems = Array.from(container.querySelectorAll('li')) as HTMLElement[];
      expect(listItems.length).toBe(2);

      // Case 4: Bullet point with Persian conjunction
      expect(listItems[0]).toHaveAttribute('dir', 'rtl');
      expect(listItems[0].style.textAlign).toBe('right');

      // Case 5: Digits only in RTL doc
      expect(listItems[1]).toHaveAttribute('dir', 'rtl');
      expect(listItems[1].style.textAlign).toBe('right');

      // 4. Code block strictly remains LTR
      const pre = container.querySelector('pre') as HTMLElement;
      expect(pre).toHaveAttribute('dir', 'ltr');
    });
  });

  describe('4. Differentiated Block Types & Short Block Suite (Task 1, 2, 4)', () => {
    describe('4.1 Mandatory Unit Tests for Block Differentiation', () => {
      it('Admin Platform: Local و Online Mode (tag: li, docDefaultDir: rtl) -> resolves to "rtl"', () => {
        const text = 'Admin Platform: Local و Online Mode';
        expect(getTextDirection(text, 'rtl', 'li')).toBe('rtl');
      });

      it('Local Admin (tag: h2, docDefaultDir: rtl) -> resolves to "rtl"', () => {
        const text = 'Local Admin';
        expect(getTextDirection(text, 'rtl', 'h2')).toBe('rtl');
      });

      it('Deploy وضعیت (tag: li, docDefaultDir: rtl) -> resolves to "rtl"', () => {
        const text = 'Deploy وضعیت';
        expect(getTextDirection(text, 'rtl', 'li')).toBe('rtl');
      });

      it('3. بررسی ارتباط Article و Affiliate Program. (tag: li, docDefaultDir: rtl) -> resolves to "rtl"', () => {
        const text = '3. بررسی ارتباط Article و Affiliate Program.';
        expect(getTextDirection(text, 'rtl', 'li')).toBe('rtl');
      });

      it('This is a long English paragraph with one کلمه. (tag: p, docDefaultDir: rtl) -> resolves to "ltr"', () => {
        const text = 'This is a long English paragraph with one کلمه.';
        expect(getTextDirection(text, 'rtl', 'p')).toBe('ltr');
      });

      it('Just English (tag: li, docDefaultDir: rtl) -> resolves to "ltr" (pure English list item)', () => {
        const text = 'Just English';
        expect(getTextDirection(text, 'rtl', 'li')).toBe('ltr');
      });
    });

    describe('4.2 LTR Document Short Block Tests', () => {
      it('Short block in LTR doc with Latin characters resolves to "ltr"', () => {
        expect(getTextDirection('Admin Platform: Local و Online Mode', 'ltr', 'li')).toBe('ltr');
        expect(getTextDirection('Just English', 'ltr', 'li')).toBe('ltr');
      });

      it('Short block in LTR doc purely Persian resolves to "rtl"', () => {
        expect(getTextDirection('عنوان فارسی', 'ltr', 'li')).toBe('rtl');
      });
    });

    describe('4.3 DOM Sweep & Inline Element Preservation', () => {
      it('applies differentiated block directions while preserving inline elements and code blocks', () => {
        const container = document.createElement('div');
        container.innerHTML = `
          <h2 id="heading-admin">Local Admin</h2>
          <ul>
            <li id="li-admin">Admin Platform: Local و Online Mode</li>
            <li id="li-deploy">Deploy وضعیت</li>
            <li id="li-article">3. بررسی ارتباط Article و Affiliate Program.</li>
            <li id="li-english">Just English</li>
          </ul>
          <p id="p-mixed">
            This is a long English paragraph with one <strong id="strong-el">کلمه</strong> and a <span id="span-el">phrase</span>.
          </p>
          <pre id="code-pre" dir="ltr"><code id="code-snippet" dir="ltr">console.log("local admin");</code></pre>
        `;

        applyDominanceDirection(container, 'rtl');

        // Heading in RTL doc -> rtl
        const h2 = container.querySelector('#heading-admin') as HTMLElement;
        expect(h2.getAttribute('dir')).toBe('rtl');
        expect(h2.style.textAlign).toBe('right');

        // List item with Persian -> rtl
        const liAdmin = container.querySelector('#li-admin') as HTMLElement;
        expect(liAdmin.getAttribute('dir')).toBe('rtl');
        expect(liAdmin.style.textAlign).toBe('right');

        const liDeploy = container.querySelector('#li-deploy') as HTMLElement;
        expect(liDeploy.getAttribute('dir')).toBe('rtl');
        expect(liDeploy.style.textAlign).toBe('right');

        const liArticle = container.querySelector('#li-article') as HTMLElement;
        expect(liArticle.getAttribute('dir')).toBe('rtl');
        expect(liArticle.style.textAlign).toBe('right');

        // Pure English list item -> ltr
        const liEnglish = container.querySelector('#li-english') as HTMLElement;
        expect(liEnglish.getAttribute('dir')).toBe('ltr');
        expect(liEnglish.style.textAlign).toBe('left');

        // Long paragraph with English dominance -> ltr
        const pMixed = container.querySelector('#p-mixed') as HTMLElement;
        expect(pMixed.getAttribute('dir')).toBe('ltr');
        expect(pMixed.style.textAlign).toBe('left');

        // Inline elements (<strong>, <span>) MUST NOT have dir set by block sweep
        const strongEl = container.querySelector('#strong-el') as HTMLElement;
        expect(strongEl.getAttribute('dir')).toBeNull();

        const spanEl = container.querySelector('#span-el') as HTMLElement;
        expect(spanEl.getAttribute('dir')).toBeNull();

        // <pre> and <code> MUST strictly remain dir="ltr"
        const pre = container.querySelector('#code-pre') as HTMLElement;
        expect(pre.getAttribute('dir')).toBe('ltr');

        const code = container.querySelector('#code-snippet') as HTMLElement;
        expect(code.getAttribute('dir')).toBe('ltr');
      });
    });

    describe('4.4 MarkdownViewer Integration with Differentiated Blocks', () => {
      it('correctly renders mixed headings, list items, and code in RTL MarkdownViewer', () => {
        const markdown = `
## Local Admin

1. Admin Platform: Local و Online Mode
2. Deploy وضعیت
3. بررسی ارتباط Article و Affiliate Program.
4. Just English

This is a long English paragraph with one کلمه.

\`\`\`bash
npm run dev
\`\`\`
        `;

        const { container } = render(
          <MarkdownViewer
            content={markdown}
            directionPreference="rtl"
            dominanceBidi={true}
          />
        );

        const markdownBody = container.querySelector('.markdown-body') || container;

        // Heading
        const h2 = markdownBody.querySelector('h2') as HTMLElement;
        expect(h2).toHaveAttribute('dir', 'rtl');
        expect(h2.style.textAlign).toBe('right');

        // List items
        const listItems = Array.from(markdownBody.querySelectorAll('li')) as HTMLElement[];
        expect(listItems.length).toBe(4);

        // 1. Admin Platform: Local و Online Mode -> rtl
        expect(listItems[0]).toHaveAttribute('dir', 'rtl');
        expect(listItems[0].style.textAlign).toBe('right');

        // 2. Deploy وضعیت -> rtl
        expect(listItems[1]).toHaveAttribute('dir', 'rtl');
        expect(listItems[1].style.textAlign).toBe('right');

        // 3. بررسی ارتباط Article و Affiliate Program. -> rtl
        expect(listItems[2]).toHaveAttribute('dir', 'rtl');
        expect(listItems[2].style.textAlign).toBe('right');

        // 4. Just English -> ltr
        expect(listItems[3]).toHaveAttribute('dir', 'ltr');
        expect(listItems[3].style.textAlign).toBe('left');

        // Paragraph -> ltr
        const p = markdownBody.querySelector('p') as HTMLElement;
        expect(p).toHaveAttribute('dir', 'ltr');
        expect(p.style.textAlign).toBe('left');

        // Code block -> ltr
        const pre = markdownBody.querySelector('pre') as HTMLElement;
        expect(pre).toHaveAttribute('dir', 'ltr');
      });
    });
  });
});
