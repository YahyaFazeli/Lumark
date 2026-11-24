import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import {
  getTextDirection,
  applyDominanceDirection,
  useDominanceDirection,
} from './autoDirection';
import { MarkdownViewer } from '../rendering/MarkdownViewer';

describe('Dominance-Based Bidi Alignment Suite', () => {
  describe('1. getTextDirection Smart Direction Detection Utility', () => {
    it('resolves mostly Persian string starting with Emoji & English to RTL (Example Case 1)', () => {
      const text = '🚨 Phase 3؟ چه زمانی مردود است؟';
      // rtlChars: 16 (Persian letters + Arabic question mark), ltrChars: 5 ('Phase')
      expect(getTextDirection(text, 'ltr')).toBe('rtl');
      expect(getTextDirection(text, 'rtl')).toBe('rtl');
    });

    it('resolves mostly English sentence with only one Persian word to LTR (Example Case 2)', () => {
      const text = 'This is a very long English sentence with only one کلمه Persian.';
      // rtlChars: 4 ('کلمه'), ltrChars: ~47 English letters
      expect(getTextDirection(text, 'rtl')).toBe('ltr');
      expect(getTextDirection(text, 'ltr')).toBe('ltr');
    });

    it('falls back to docDefaultDir when no directional letters exist (Example Case 3)', () => {
      const numbers = '12345678';
      expect(getTextDirection(numbers, 'rtl')).toBe('rtl');
      expect(getTextDirection(numbers, 'ltr')).toBe('ltr');

      const emojis = '🚨🔥🎉✨💡';
      expect(getTextDirection(emojis, 'rtl')).toBe('rtl');
      expect(getTextDirection(emojis, 'ltr')).toBe('ltr');

      const punctuation = '... --- === !!! ???';
      expect(getTextDirection(punctuation, 'rtl')).toBe('rtl');
      expect(getTextDirection(punctuation, 'ltr')).toBe('ltr');

      const empty = '';
      expect(getTextDirection(empty, 'rtl')).toBe('rtl');
      expect(getTextDirection(empty, 'ltr')).toBe('ltr');
    });

    it('resolves code string to LTR (Example Case 4)', () => {
      const codeSnippet = 'const x = 1;';
      expect(getTextDirection(codeSnippet, 'rtl')).toBe('ltr');
      expect(getTextDirection(codeSnippet, 'ltr')).toBe('ltr');
    });

    it('falls back to docDefaultDir on exact tie between RTL and LTR character counts', () => {
      // 4 Persian chars ('سلام') and 4 English chars ('test')
      const tieText = 'سلام test';
      expect(getTextDirection(tieText, 'rtl')).toBe('rtl');
      expect(getTextDirection(tieText, 'ltr')).toBe('ltr');
    });
  });

  describe('2. applyDominanceDirection DOM Sweep on Block-Level Elements', () => {
    it('applies dir and text-align to all target block tags (<p>, <h1>-<h6>, <li>, <blockquote>, <td>, <th>)', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <p id="p1">🚨 Phase 3؟ چه زمانی مردود است؟</p>
        <h1 id="h1">عنوان اصلی با Docker</h1>
        <h2 id="h2">Secondary Heading in English</h2>
        <blockquote id="bq">این یک نقل قول به زبان فارسی است.</blockquote>
        <ul>
          <li id="li1">English list item</li>
          <li id="li2">آیتم لیست به زبان شیرین فارسی</li>
        </ul>
        <table>
          <thead>
            <tr>
              <th id="th1">نام ستون</th>
              <th id="th2">Column Name</th>
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

      applyDominanceDirection(container, 'ltr');

      const p1 = container.querySelector('#p1') as HTMLElement;
      expect(p1.getAttribute('dir')).toBe('rtl');
      expect(p1.style.textAlign).toBe('right');

      const h1 = container.querySelector('#h1') as HTMLElement;
      expect(h1.getAttribute('dir')).toBe('rtl');
      expect(h1.style.textAlign).toBe('right');

      const h2 = container.querySelector('#h2') as HTMLElement;
      expect(h2.getAttribute('dir')).toBe('ltr');
      expect(h2.style.textAlign).toBe('left');

      const bq = container.querySelector('#bq') as HTMLElement;
      expect(bq.getAttribute('dir')).toBe('rtl');
      expect(bq.style.textAlign).toBe('right');

      const li1 = container.querySelector('#li1') as HTMLElement;
      expect(li1.getAttribute('dir')).toBe('ltr');
      expect(li1.style.textAlign).toBe('left');

      const li2 = container.querySelector('#li2') as HTMLElement;
      expect(li2.getAttribute('dir')).toBe('rtl');
      expect(li2.style.textAlign).toBe('right');

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

    it('DO NOT apply to <code>, <pre>, or inline elements (<strong>, <em>, <span>)', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <p id="p">
          این یک متن فارسی با <strong id="strong">متن ضخیم</strong> و <span id="span">برچسب</span> است.
        </p>
        <pre id="pre" dir="ltr"><code id="code" dir="ltr">const x = 1;\nconsole.log(x);</code></pre>
      `;

      applyDominanceDirection(container, 'ltr');

      const p = container.querySelector('#p') as HTMLElement;
      expect(p.getAttribute('dir')).toBe('rtl');
      expect(p.style.textAlign).toBe('right');

      // Inline elements must NOT receive dir or style overrides
      const strong = container.querySelector('#strong') as HTMLElement;
      expect(strong.getAttribute('dir')).toBeNull();
      expect(strong.style.textAlign).toBe('');

      const span = container.querySelector('#span') as HTMLElement;
      expect(span.getAttribute('dir')).toBeNull();
      expect(span.style.textAlign).toBe('');

      // <pre> and <code> MUST strictly remain LTR
      const pre = container.querySelector('#pre') as HTMLElement;
      expect(pre.getAttribute('dir')).toBe('ltr');
      expect(pre.style.textAlign).not.toBe('right');

      const code = container.querySelector('#code') as HTMLElement;
      expect(code.getAttribute('dir')).toBe('ltr');
      expect(code.style.textAlign).not.toBe('right');
    });

    it('preserves code block LTR isolation even when nested inside RTL blockquote or list item', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <blockquote id="bq">
          <p id="bq-p">نقل قول فارسی با کد زیر:</p>
          <pre id="nested-pre" dir="ltr"><code id="nested-code" dir="ltr">function test() { return true; }</code></pre>
        </blockquote>
      `;

      applyDominanceDirection(container, 'rtl');

      const bq = container.querySelector('#bq') as HTMLElement;
      expect(bq.getAttribute('dir')).toBe('rtl');
      expect(bq.style.textAlign).toBe('right');

      const nestedPre = container.querySelector('#nested-pre') as HTMLElement;
      expect(nestedPre.getAttribute('dir')).toBe('ltr');

      const nestedCode = container.querySelector('#nested-code') as HTMLElement;
      expect(nestedCode.getAttribute('dir')).toBe('ltr');
    });
  });

  describe('3. useDominanceDirection Hook', () => {
    it('executes post-render DOM sweep via React hook', () => {
      const TestComponent: React.FC<{ docDefaultDir: 'rtl' | 'ltr' }> = ({ docDefaultDir }) => {
        const ref = React.useRef<HTMLDivElement | null>(null);
        useDominanceDirection(ref, docDefaultDir);

        return (
          <div ref={ref}>
            <p id="hook-p1">🚨 Phase 3؟ چه زمانی مردود است؟</p>
            <p id="hook-p2">This is predominantly English text.</p>
          </div>
        );
      };

      const { container } = render(<TestComponent docDefaultDir="ltr" />);
      const p1 = container.querySelector('#hook-p1') as HTMLElement;
      const p2 = container.querySelector('#hook-p2') as HTMLElement;

      expect(p1.getAttribute('dir')).toBe('rtl');
      expect(p1.style.textAlign).toBe('right');

      expect(p2.getAttribute('dir')).toBe('ltr');
      expect(p2.style.textAlign).toBe('left');
    });
  });

  describe('4. MarkdownViewer Integration & Visual Verification (Mixed Paragraphs in RTL Document)', () => {
    it('aligns mixed paragraphs correctly without altering global document direction', () => {
      const mixedMarkdown = `
# مستند جامع فنی سیستم

این یک پاراگراف مقدماتی به زبان فارسی است که باید به طور کامل راست‌به‌چپ باشد.

This is a very long English sentence with only one کلمه Persian.

🚨 Phase 3؟ چه زمانی مردود است؟

12345678

\`\`\`javascript
const x = 1;
console.log(x);
\`\`\`
      `;

      const { container } = render(
        <MarkdownViewer
          content={mixedMarkdown}
          directionPreference="rtl"
          dominanceBidi={true}
        />
      );

      // 1. Overall document container direction remains untouched (RTL per directionPreference)
      const mainContent = container.querySelector('.markdown-content') as HTMLElement;
      expect(mainContent).toHaveAttribute('dir', 'rtl');

      // 2. Mostly Persian heading -> RTL
      const h1 = container.querySelector('h1') as HTMLElement;
      expect(h1.getAttribute('dir')).toBe('rtl');
      expect(h1.style.textAlign).toBe('right');

      // 3. Paragraphs
      const paragraphs = Array.from(container.querySelectorAll('p')) as HTMLElement[];
      expect(paragraphs.length).toBe(4);

      // p[0]: Pure Persian -> RTL
      expect(paragraphs[0].getAttribute('dir')).toBe('rtl');
      expect(paragraphs[0].style.textAlign).toBe('right');

      // p[1]: Mostly English with one Persian word ("کلمه") -> LTR
      expect(paragraphs[1].getAttribute('dir')).toBe('ltr');
      expect(paragraphs[1].style.textAlign).toBe('left');

      // p[2]: Mostly Persian starting with Emoji/English ("🚨 Phase 3؟ چه زمانی مردود است؟") -> RTL
      expect(paragraphs[2].getAttribute('dir')).toBe('rtl');
      expect(paragraphs[2].style.textAlign).toBe('right');

      // p[3]: Digits only ("12345678") -> falls back to docDefaultDir ('rtl')
      expect(paragraphs[3].getAttribute('dir')).toBe('rtl');
      expect(paragraphs[3].style.textAlign).toBe('right');

      // 4. Code block strictly remains LTR
      const pre = container.querySelector('pre') as HTMLElement;
      expect(pre).toHaveAttribute('dir', 'ltr');
    });

    it('preserves LTR document default when document is predominantly LTR', () => {
      const ltrMarkdown = `
# System Architecture Guide

This is an introductory English paragraph explaining the system design.

🚨 Phase 3؟ چه زمانی مردود است؟

98765432
      `;

      const { container } = render(
        <MarkdownViewer
          content={ltrMarkdown}
          directionPreference="ltr"
          dominanceBidi={true}
        />
      );

      // Global document direction is LTR
      const mainContent = container.querySelector('.markdown-content') as HTMLElement;
      expect(mainContent).toHaveAttribute('dir', 'ltr');

      // English paragraph -> LTR
      const paragraphs = Array.from(container.querySelectorAll('p')) as HTMLElement[];
      expect(paragraphs[0].getAttribute('dir')).toBe('ltr');
      expect(paragraphs[0].style.textAlign).toBe('left');

      // Persian paragraph starting with emoji/English -> RTL
      expect(paragraphs[1].getAttribute('dir')).toBe('rtl');
      expect(paragraphs[1].style.textAlign).toBe('right');

      // Digits only -> falls back to docDefaultDir ('ltr')
      expect(paragraphs[2].getAttribute('dir')).toBe('ltr');
      expect(paragraphs[2].style.textAlign).toBe('left');
    });
  });
});
