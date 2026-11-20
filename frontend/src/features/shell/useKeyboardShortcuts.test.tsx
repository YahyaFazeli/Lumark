import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, renderHook } from '@testing-library/react';
import {
  useKeyboardShortcuts,
  useHotkeys,
  isEditableElement,
  matchesShortcut,
  ShortcutConfig,
} from './useKeyboardShortcuts';

describe('useKeyboardShortcuts & useHotkeys Hook', () => {
  let onCloseTab: ReturnType<typeof vi.fn>;
  let onNewTab: ReturnType<typeof vi.fn>;
  let onOpenFile: ReturnType<typeof vi.fn>;
  let onSave: ReturnType<typeof vi.fn>;
  let onNavigateHome: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCloseTab = vi.fn();
    onNewTab = vi.fn();
    onOpenFile = vi.fn();
    onSave = vi.fn();
    onNavigateHome = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers tab close action when Ctrl+W is pressed and calls preventDefault', () => {
    const shortcuts: ShortcutConfig[] = [
      {
        key: 'w',
        ctrlOrMeta: true,
        allowInEditable: true,
        handler: onCloseTab,
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent('keydown', {
      key: 'w',
      code: 'KeyW',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(onCloseTab).toHaveBeenCalledTimes(1);
  });

  it('triggers tab close action when Cmd+W (macOS metaKey) is pressed', () => {
    const shortcuts: ShortcutConfig[] = [
      {
        key: 'w',
        ctrlOrMeta: true,
        allowInEditable: true,
        handler: onCloseTab,
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent('keydown', {
      key: 'W',
      code: 'KeyW',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(onCloseTab).toHaveBeenCalledTimes(1);
  });

  it('triggers new tab action on Ctrl+T and Cmd+T', () => {
    const shortcuts: ShortcutConfig[] = [
      {
        key: 't',
        ctrlOrMeta: true,
        allowInEditable: true,
        handler: onNewTab,
      },
    ];

    renderHook(() => useHotkeys(shortcuts));

    // Ctrl+T
    fireEvent.keyDown(window, { key: 't', code: 'KeyT', ctrlKey: true });
    expect(onNewTab).toHaveBeenCalledTimes(1);

    // Cmd+T
    fireEvent.keyDown(window, { key: 'T', code: 'KeyT', metaKey: true });
    expect(onNewTab).toHaveBeenCalledTimes(2);
  });

  it('triggers open file action on Ctrl+O', () => {
    const shortcuts: ShortcutConfig[] = [
      {
        key: 'o',
        ctrlOrMeta: true,
        allowInEditable: true,
        handler: onOpenFile,
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireEvent.keyDown(window, { key: 'o', code: 'KeyO', ctrlKey: true });
    expect(onOpenFile).toHaveBeenCalledTimes(1);
  });

  describe('Focus inside editable elements (input, textarea, CodeMirror, Monaco)', () => {
    function TestEditableComponent({ shortcuts }: { shortcuts: ShortcutConfig[] }) {
      useKeyboardShortcuts(shortcuts);

      return (
        <div>
          <input type="text" data-testid="text-input" placeholder="Type here..." />
          <textarea data-testid="textarea-input" placeholder="Notes..." />
          <div className="cm-editor" data-testid="codemirror-editor">
            <div
              className="cm-content"
              role="textbox"
              contentEditable
              suppressContentEditableWarning
              data-testid="cm-content"
            >
              CodeMirror content
            </div>
          </div>
          <div className="monaco-editor" data-testid="monaco-editor">
            <textarea className="inputarea" data-testid="monaco-textarea" />
          </div>
          <div contentEditable suppressContentEditableWarning data-testid="contenteditable-div">
            Editable text
          </div>
        </div>
      );
    }

    it('allows global shortcuts (Ctrl+W, Ctrl+S) even when focused inside an input or editor', () => {
      const shortcuts: ShortcutConfig[] = [
        {
          key: 'w',
          ctrlOrMeta: true,
          allowInEditable: true,
          handler: onCloseTab,
        },
        {
          key: 's',
          ctrlOrMeta: true,
          allowInEditable: true,
          handler: onSave,
        },
      ];

      const { getByTestId } = render(<TestEditableComponent shortcuts={shortcuts} />);

      // Inside <input>
      const input = getByTestId('text-input');
      input.focus();
      fireEvent.keyDown(input, { key: 'w', code: 'KeyW', ctrlKey: true });
      expect(onCloseTab).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(input, { key: 's', code: 'KeyS', ctrlKey: true });
      expect(onSave).toHaveBeenCalledTimes(1);

      // Inside CodeMirror
      const cm = getByTestId('cm-content');
      cm.focus();
      fireEvent.keyDown(cm, { key: 'w', code: 'KeyW', ctrlKey: true });
      expect(onCloseTab).toHaveBeenCalledTimes(2);

      // Inside Monaco Editor
      const monaco = getByTestId('monaco-textarea');
      monaco.focus();
      fireEvent.keyDown(monaco, { key: 'w', code: 'KeyW', ctrlKey: true });
      expect(onCloseTab).toHaveBeenCalledTimes(3);
    });

    it('does NOT hijack typing when focused inside an input/textarea/editor for non-global shortcuts', () => {
      const shortcuts: ShortcutConfig[] = [
        {
          key: 'h',
          ctrlOrMeta: true,
          allowInEditable: false,
          handler: onNavigateHome,
        },
      ];

      const { getByTestId } = render(<TestEditableComponent shortcuts={shortcuts} />);

      // Typing inside <input>
      const input = getByTestId('text-input');
      input.focus();

      // Normal typing: 'h'
      fireEvent.keyDown(input, { key: 'h', code: 'KeyH' });
      expect(onNavigateHome).not.toHaveBeenCalled();

      // Ctrl+H inside input should NOT trigger Home navigation
      fireEvent.keyDown(input, { key: 'h', code: 'KeyH', ctrlKey: true });
      expect(onNavigateHome).not.toHaveBeenCalled();

      // Inside <textarea>
      const textarea = getByTestId('textarea-input');
      textarea.focus();
      fireEvent.keyDown(textarea, { key: 'h', code: 'KeyH', ctrlKey: true });
      expect(onNavigateHome).not.toHaveBeenCalled();

      // Inside CodeMirror
      const cm = getByTestId('cm-content');
      cm.focus();
      fireEvent.keyDown(cm, { key: 'h', code: 'KeyH', ctrlKey: true });
      expect(onNavigateHome).not.toHaveBeenCalled();

      // Inside Monaco
      const monaco = getByTestId('monaco-textarea');
      monaco.focus();
      fireEvent.keyDown(monaco, { key: 'h', code: 'KeyH', ctrlKey: true });
      expect(onNavigateHome).not.toHaveBeenCalled();

      // Inside contenteditable
      const editable = getByTestId('contenteditable-div');
      editable.focus();
      fireEvent.keyDown(editable, { key: 'h', code: 'KeyH', ctrlKey: true });
      expect(onNavigateHome).not.toHaveBeenCalled();

      // When blurring or on document body, Ctrl+H triggers normally
      fireEvent.keyDown(window, { key: 'h', code: 'KeyH', ctrlKey: true });
      expect(onNavigateHome).toHaveBeenCalledTimes(1);
    });
  });

  describe('isEditableElement detection', () => {
    it('accurately identifies editable vs non-editable DOM targets', () => {
      const div = document.createElement('div');
      expect(isEditableElement(div)).toBe(false);

      const textInput = document.createElement('input');
      textInput.type = 'text';
      expect(isEditableElement(textInput)).toBe(true);

      const searchInput = document.createElement('input');
      searchInput.type = 'search';
      expect(isEditableElement(searchInput)).toBe(true);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      expect(isEditableElement(checkbox)).toBe(false);

      const textarea = document.createElement('textarea');
      expect(isEditableElement(textarea)).toBe(true);

      const contentEditable = document.createElement('div');
      contentEditable.setAttribute('contenteditable', 'true');
      expect(isEditableElement(contentEditable)).toBe(true);

      const cmContainer = document.createElement('div');
      cmContainer.className = 'cm-editor';
      const cmChild = document.createElement('span');
      cmContainer.appendChild(cmChild);
      expect(isEditableElement(cmChild)).toBe(true);

      const monacoContainer = document.createElement('div');
      monacoContainer.className = 'monaco-editor';
      const monacoChild = document.createElement('div');
      monacoContainer.appendChild(monacoChild);
      expect(isEditableElement(monacoChild)).toBe(true);
    });
  });

  describe('International layout and fallback support', () => {
    it('matches via e.code even when e.key is non-Latin or localized', () => {
      const config: ShortcutConfig = {
        key: 'w',
        ctrlOrMeta: true,
        handler: onCloseTab,
      };

      // Simulating a non-Latin keyboard where key is Arabic/Persian 'ص' but physical key is KeyW
      const event = new KeyboardEvent('keydown', {
        key: 'ص',
        code: 'KeyW',
        ctrlKey: true,
      });

      expect(matchesShortcut(event, config)).toBe(true);
    });
  });

  describe('Window focus on mount for Wails runtime', () => {
    it('calls window.focus on mount to ensure webview receives keyboard events', () => {
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        configurable: true,
      });

      const focusSpy = vi.spyOn(window, 'focus').mockImplementation(() => {});
      renderHook(() => useKeyboardShortcuts([]));
      expect(focusSpy).toHaveBeenCalled();

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      });
    });
  });

  describe('event.defaultPrevented guard', () => {
    it('ignores events that were already prevented by another listener', () => {
      const handler = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts([
          {
            key: 'w',
            ctrlOrMeta: true,
            handler,
          },
        ])
      );

      const event = new KeyboardEvent('keydown', {
        key: 'w',
        code: 'KeyW',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      event.preventDefault(); // Already prevented

      window.dispatchEvent(event);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
