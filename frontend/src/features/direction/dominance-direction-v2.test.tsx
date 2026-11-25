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
        <ul id="test-ul">
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

      // Case 3 in heading (pure English heading in RTL doc gets dir="ltr" with right-alignment)
      const h1 = container.querySelector('#case3-h1') as HTMLElement;
      expect(h1.getAttribute('dir')).toBe('ltr');
      expect(h1.style.textAlign).toBe('right');

      // Case 1 in paragraph
      const p1 = container.querySelector('#case1-p') as HTMLElement;
      expect(p1.getAttribute('dir')).toBe('rtl');
      expect(p1.style.textAlign).toBe('right');

      // Case 2 in paragraph
      const p2 = container.querySelector('#case2-p') as HTMLElement;
      expect(p2.getAttribute('dir')).toBe('ltr');
      expect(p2.style.textAlign).toBe('left');

      // Case 4 & 5 in list container (contains Persian character 'و' -> dir="rtl", text-align: right)
      const ul = container.querySelector('#test-ul') as HTMLElement;
      expect(ul.getAttribute('dir')).toBe('rtl');
      expect(ul.style.textAlign).toBe('right');

      // Individual list items inside ul in RTL doc do NOT get dir="ltr", inheriting direction from parent
      const li1 = container.querySelector('#case4-li') as HTMLElement;
      expect(li1.getAttribute('dir')).toBeNull();

      const li2 = container.querySelector('#case5-li') as HTMLElement;
      expect(li2.getAttribute('dir')).toBeNull();

      // Blockquote
      const bq = container.querySelector('#bq') as HTMLElement;
      expect(bq.getAttribute('dir')).toBe('rtl');
      expect(bq.style.textAlign).toBe('right');

      // Table cells & headers in RTL doc are structural blocks (all right-aligned)
      const th1 = container.querySelector('#th1') as HTMLElement;
      expect(th1.getAttribute('dir')).toBe('rtl');
      expect(th1.style.textAlign).toBe('right');

      const th2 = container.querySelector('#th2') as HTMLElement;
      expect(th2.getAttribute('dir')).toBe('ltr');
      expect(th2.style.textAlign).toBe('right');

      const td1 = container.querySelector('#td1') as HTMLElement;
      expect(td1.getAttribute('dir')).toBe('rtl');
      expect(td1.style.textAlign).toBe('right');

      const td2 = container.querySelector('#td2') as HTMLElement;
      expect(td2.getAttribute('dir')).toBe('ltr');
      expect(td2.style.textAlign).toBe('right');
    });

    it('strictly excludes <pre> and <code> elements, preserving dir="ltr"', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <h2 id="heading">8. Phase 6 — Git Provider Integration</h2>
        <pre id="pre-block" dir="ltr"><code id="code-block" dir="ltr">const git = require('git-provider');\nconsole.log(git.status());</code></pre>
        <p id="inline-code-p">دستور <code id="inline-code" dir="ltr">git push origin main</code> را اجرا کنید.</p>
      `;

      applyDominanceDirection(container, 'rtl');

      // Pure English heading in RTL doc gets dir="ltr" and style.textAlign="right"
      const h2 = container.querySelector('#heading') as HTMLElement;
      expect(h2.getAttribute('dir')).toBe('ltr');
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

      // 1. Heading (Case 3 in RTL doc: pure English heading right-aligned with dir="ltr")
      const h1 = container.querySelector('h1') as HTMLElement;
      expect(h1).toHaveAttribute('dir', 'ltr');
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

      // 3. List container (contains Persian character 'و' -> dir="rtl", textAlign="right")
      const ul = container.querySelector('ul') as HTMLElement;
      expect(ul).toHaveAttribute('dir', 'rtl');
      expect(ul.style.textAlign).toBe('right');

      const listItems = Array.from(container.querySelectorAll('li')) as HTMLElement[];
      expect(listItems.length).toBe(2);
      expect(listItems[0].getAttribute('dir')).toBeNull();
      expect(listItems[1].getAttribute('dir')).toBeNull();

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

      it('Local Admin (tag: h2, docDefaultDir: rtl) -> resolves to "ltr" (pure English heading gets dir="ltr")', () => {
        const text = 'Local Admin';
        expect(getTextDirection(text, 'rtl', 'h2')).toBe('ltr');
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

      it('Just English (tag: li, docDefaultDir: rtl) -> resolves to "ltr" (pure English list item gets dir="ltr")', () => {
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

        // Heading in RTL doc -> pure English heading gets dir="ltr" and style.textAlign="right"
        const h2 = container.querySelector('#heading-admin') as HTMLElement;
        expect(h2.getAttribute('dir')).toBe('ltr');
        expect(h2.style.textAlign).toBe('right');

        // List container with Persian items -> dir="rtl", style.textAlign="right" (bullets on right)
        const ul = container.querySelector('ul') as HTMLElement;
        expect(ul.getAttribute('dir')).toBe('rtl');
        expect(ul.style.textAlign).toBe('right');

        // Individual list items in RTL doc do NOT receive dir="ltr", inheriting RTL from ul
        const liAdmin = container.querySelector('#li-admin') as HTMLElement;
        expect(liAdmin.getAttribute('dir')).toBeNull();

        const liDeploy = container.querySelector('#li-deploy') as HTMLElement;
        expect(liDeploy.getAttribute('dir')).toBeNull();

        const liArticle = container.querySelector('#li-article') as HTMLElement;
        expect(liArticle.getAttribute('dir')).toBeNull();

        const liEnglish = container.querySelector('#li-english') as HTMLElement;
        expect(liEnglish.getAttribute('dir')).toBeNull();

        // Long paragraph with English dominance -> ltr and left-aligned
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

        // Heading: Pure English heading in RTL doc gets dir="ltr" and textAlign="right"
        const h2 = markdownBody.querySelector('h2') as HTMLElement;
        expect(h2).toHaveAttribute('dir', 'ltr');
        expect(h2.style.textAlign).toBe('right');

        // List container: ordered list with Persian items -> dir="rtl", style.textAlign="right"
        const ol = markdownBody.querySelector('ol') as HTMLElement;
        expect(ol).toHaveAttribute('dir', 'rtl');
        expect(ol.style.textAlign).toBe('right');

        // List items inherit from ol and are not forced to dir="ltr"
        const listItems = Array.from(markdownBody.querySelectorAll('li')) as HTMLElement[];
        expect(listItems.length).toBe(4);
        listItems.forEach((li) => {
          expect(li.getAttribute('dir')).toBeNull();
        });

        // Paragraph -> ltr, left-aligned
        const p = markdownBody.querySelector('p') as HTMLElement;
        expect(p).toHaveAttribute('dir', 'ltr');
        expect(p.style.textAlign).toBe('left');

        // Code block -> ltr
        const pre = markdownBody.querySelector('pre') as HTMLElement;
        expect(pre).toHaveAttribute('dir', 'ltr');
      });
    });
  });

  describe('5. Force Right-Alignment & English LTR Sequence in RTL Documents', () => {
    describe('5.1 Mandatory Unit Tests (User Examples)', () => {
      it('Phase 1 — Project Foundation (tag: h2, docDefaultDir: rtl) -> dir="ltr"', () => {
        const text = 'Phase 1 — Project Foundation';
        expect(getTextDirection(text, 'rtl', 'h2')).toBe('ltr');
      });

      it('Phase 1 — معماری سیستم (tag: h2, docDefaultDir: rtl) -> dir="rtl"', () => {
        const text = 'Phase 1 — معماری سیستم';
        expect(getTextDirection(text, 'rtl', 'h2')).toBe('rtl');
      });

      it('Phase 4 — Media Infrastructure (tag: h3, docDefaultDir: rtl) -> dir="ltr"', () => {
        const text = 'Phase 4 — Media Infrastructure';
        expect(getTextDirection(text, 'rtl', 'h3')).toBe('ltr');
      });

      it('8. Phase 8 — Deployment & Production Readiness (tag: li, docDefaultDir: rtl) -> dir="ltr"', () => {
        const text = '8. Phase 8 — Deployment & Production Readiness';
        expect(getTextDirection(text, 'rtl', 'li')).toBe('ltr');
      });

      it('8. **Phase 8 — Deployment & Production Readiness** (tag: li, docDefaultDir: rtl) -> dir="ltr"', () => {
        const text = '8. **Phase 8 — Deployment & Production Readiness**';
        expect(getTextDirection(text, 'rtl', 'li')).toBe('ltr');
      });

      it('This is a very long English paragraph inside an RTL document. (tag: p, docDefaultDir: rtl) -> dir="ltr"', () => {
        const text = 'This is a very long English paragraph inside an RTL document.';
        expect(getTextDirection(text, 'rtl', 'p')).toBe('ltr');
      });
    });

    describe('5.2 DOM Sweep Verification of Alignment and Character Ordering', () => {
      it('forces style.textAlign="right" on structural blocks while preserving dir="ltr" on English blocks', () => {
        const container = document.createElement('div');
        container.innerHTML = `
          <h2 id="h-eng">Phase 1 — Project Foundation</h2>
          <h2 id="h-fa">Phase 1 — معماری سیستم</h2>
          <p id="p-eng">This is a very long English paragraph inside an RTL document.</p>
        `;

        applyDominanceDirection(container, 'rtl');

        const hEng = container.querySelector('#h-eng') as HTMLElement;
        expect(hEng.getAttribute('dir')).toBe('ltr');
        expect(hEng.style.textAlign).toBe('right');

        const hFa = container.querySelector('#h-fa') as HTMLElement;
        expect(hFa.getAttribute('dir')).toBe('rtl');
        expect(hFa.style.textAlign).toBe('right');

        const pEng = container.querySelector('#p-eng') as HTMLElement;
        expect(pEng.getAttribute('dir')).toBe('ltr');
        expect(pEng.style.textAlign).toBe('left');
      });
    });

    describe('5.3 MarkdownViewer Rendering Verification of Pure English Structural Blocks in RTL Doc', () => {
      it('renders English headings and list items with dir="ltr" and textAlign="right"', () => {
        const markdown = `
### Phase 4 — Media Infrastructure

1. Phase 1 — Project Scaffold
2. Phase 2 — Core Engine
8. Phase 8 — Deployment & Production Readiness

This is a very long English paragraph inside an RTL document.

\`\`\`typescript
const isRtl = true;
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

        // Heading: English in RTL doc -> dir="ltr" for correct character/number sequence, right-aligned
        const h3 = markdownBody.querySelector('h3') as HTMLElement;
        expect(h3).toHaveAttribute('dir', 'ltr');
        expect(h3.style.textAlign).toBe('right');

        // List container: Pure English list in RTL doc -> dir="ltr", textAlign="left" (bullets/numbers on left)
        const ol = markdownBody.querySelector('ol') as HTMLElement;
        expect(ol).toHaveAttribute('dir', 'ltr');
        expect(ol.style.textAlign).toBe('left');

        const listItems = Array.from(markdownBody.querySelectorAll('li')) as HTMLElement[];
        expect(listItems.length).toBe(3);
        listItems.forEach((li) => {
          expect(li.getAttribute('dir')).toBeNull();
        });

        // Paragraph: Pure English in RTL doc -> strictly remains dir="ltr", text-align: left
        const p = markdownBody.querySelector('p') as HTMLElement;
        expect(p).toHaveAttribute('dir', 'ltr');
        expect(p.style.textAlign).toBe('left');

        // Code block: Strictly remains dir="ltr"
        const pre = markdownBody.querySelector('pre') as HTMLElement;
        expect(pre).toHaveAttribute('dir', 'ltr');
      });
    });
  });

  describe('6. List Container Direction & Bullets Alignment Suite (Tasks 1, 2, 5)', () => {
    it('Test A (Mixed List): docDefaultDir = "rtl", <ul><li>Git Commit و Push</li><li>Deploy</li></ul> -> Expected: <ul dir="rtl" style="text-align: right">, bullets on the right', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <ul id="test-a-ul">
          <li id="test-a-li1">Git Commit و Push</li>
          <li id="test-a-li2">Deploy</li>
        </ul>
      `;

      applyDominanceDirection(container, 'rtl');

      const ul = container.querySelector('#test-a-ul') as HTMLElement;
      expect(ul.getAttribute('dir')).toBe('rtl');
      expect(ul.style.textAlign).toBe('right');

      const li1 = container.querySelector('#test-a-li1') as HTMLElement;
      const li2 = container.querySelector('#test-a-li2') as HTMLElement;
      // Individual <li> elements must NOT receive dir="ltr"
      expect(li1.getAttribute('dir')).toBeNull();
      expect(li2.getAttribute('dir')).toBeNull();
    });

    it('Test B (Pure English List): docDefaultDir = "rtl", <ul><li>Git is the source of truth.</li><li>No database.</li></ul> -> Expected: <ul dir="ltr" style="text-align: left">, bullets on the left', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <ul id="test-b-ul">
          <li id="test-b-li1">Git is the source of truth.</li>
          <li id="test-b-li2">No database.</li>
        </ul>
      `;

      applyDominanceDirection(container, 'rtl');

      const ul = container.querySelector('#test-b-ul') as HTMLElement;
      expect(ul.getAttribute('dir')).toBe('ltr');
      expect(ul.style.textAlign).toBe('left');

      const li1 = container.querySelector('#test-b-li1') as HTMLElement;
      const li2 = container.querySelector('#test-b-li2') as HTMLElement;
      expect(li1.getAttribute('dir')).toBeNull();
      expect(li2.getAttribute('dir')).toBeNull();
    });

    it('Test C (English Heading): docDefaultDir = "rtl", <h2>Phase 7 — Online Admin</h2> -> Expected: <h2 dir="ltr" style="text-align: right">', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <h2 id="test-c-h2">Phase 7 — Online Admin</h2>
      `;

      applyDominanceDirection(container, 'rtl');

      const h2 = container.querySelector('#test-c-h2') as HTMLElement;
      expect(h2.getAttribute('dir')).toBe('ltr');
      expect(h2.style.textAlign).toBe('right');
    });

    it('renders Mixed List and Pure English List correctly in MarkdownViewer with dominanceBidi={true}', () => {
      const markdown = `
## Phase 7 — Online Admin

- Git Commit و Push
- Deploy

### Architecture Rules

- Git is the source of truth.
- No database.
      `;

      const { container } = render(
        <MarkdownViewer
          content={markdown}
          directionPreference="rtl"
          dominanceBidi={true}
        />
      );

      const markdownBody = container.querySelector('.markdown-body') || container;

      // Heading: dir="ltr", style.textAlign="right"
      const h2 = markdownBody.querySelector('h2') as HTMLElement;
      expect(h2).toHaveAttribute('dir', 'ltr');
      expect(h2.style.textAlign).toBe('right');

      const uls = Array.from(markdownBody.querySelectorAll('ul')) as HTMLElement[];
      expect(uls.length).toBe(2);

      // First ul: Mixed list with Persian -> dir="rtl", textAlign="right" (bullets on right)
      expect(uls[0]).toHaveAttribute('dir', 'rtl');
      expect(uls[0].style.textAlign).toBe('right');

      // Second ul: Pure English list -> dir="ltr", textAlign="left" (bullets on left)
      expect(uls[1]).toHaveAttribute('dir', 'ltr');
      expect(uls[1].style.textAlign).toBe('left');
    });
  });
});
