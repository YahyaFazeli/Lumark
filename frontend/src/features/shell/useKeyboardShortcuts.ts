import { useEffect, useRef, useCallback } from 'react';

/**
 * Checks if the target element is an editable input, textarea,
 * contenteditable region, or CodeMirror / Monaco editor instance.
 */
export function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toUpperCase();

  // Standard form elements capturing text input
  if (tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  if (tagName === 'INPUT') {
    const inputType = (target as HTMLInputElement).type?.toLowerCase();
    const nonTextTypes = ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color'];
    if (!nonTextTypes.includes(inputType)) {
      return true;
    }
  }

  // HTML contenteditable elements
  if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') {
    return true;
  }

  // CodeMirror (v5 and v6) or Monaco editor containers
  if (
    target.closest('.cm-editor') ||
    target.closest('.CodeMirror') ||
    target.closest('.monaco-editor') ||
    target.closest('[contenteditable="true"]')
  ) {
    return true;
  }

  return false;
}

export type ShortcutHandler = ((event: KeyboardEvent) => void) | (() => void) | Function;

export interface ShortcutConfig {
  /**
   * The key or array of keys/codes to match.
   * Case-insensitive matching is performed for letters.
   * e.g. 'w', ['w', 'KeyW'], ',', ['Comma', ',']
   */
  key: string | string[];

  /** Matches either Ctrl (Windows/Linux) or Command (macOS) */
  ctrlOrMeta?: boolean;

  /** Matches exact ctrlKey state */
  ctrl?: boolean;

  /** Matches exact metaKey state */
  meta?: boolean;

  /** Matches exact altKey state */
  alt?: boolean;

  /** Matches exact shiftKey state (if undefined, shift state is ignored) */
  shift?: boolean;

  /**
   * If true, this shortcut will execute even if an input, textarea,
   * or CodeMirror/Monaco editor has focus.
   * Used for global document-level actions like Ctrl+S, Ctrl+W, Ctrl+T, Ctrl+O, Ctrl+P.
   * Default: false
   */
  allowInEditable?: boolean;

  /** Handler function invoked when shortcut triggers */
  handler: ShortcutHandler;

  /** Optional descriptive label */
  description?: string;
}

export function matchesKey(event: KeyboardEvent, keyOrCode: string): boolean {
  const targetLower = keyOrCode.toLowerCase();
  const eventKeyLower = event.key?.toLowerCase();
  const eventCodeLower = event.code?.toLowerCase();

  return (
    eventKeyLower === targetLower ||
    eventCodeLower === targetLower ||
    (Boolean(event.code) && event.code.toLowerCase() === `key${targetLower}`)
  );
}

export function matchesShortcut(event: KeyboardEvent, config: ShortcutConfig): boolean {
  // Check modifiers
  if (config.ctrlOrMeta) {
    if (!event.ctrlKey && !event.metaKey) {
      return false;
    }
  } else {
    if (config.ctrl !== undefined && event.ctrlKey !== config.ctrl) {
      return false;
    }
    if (config.meta !== undefined && event.metaKey !== config.meta) {
      return false;
    }
  }

  if (config.alt !== undefined && event.altKey !== config.alt) {
    return false;
  }

  if (config.shift !== undefined && event.shiftKey !== config.shift) {
    return false;
  }

  // Check key/code
  const keys = Array.isArray(config.key) ? config.key : [config.key];
  const keyMatches = keys.some((k) => matchesKey(event, k));
  if (!keyMatches) {
    return false;
  }

  return true;
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  target?: EventTarget | null;
}

/**
 * Custom hook to register keyboard shortcuts globally on window or document.
 * Handles cross-platform Ctrl/Cmd modifiers, input hijacking protection,
 * and automatic event.preventDefault().
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, target } = options;
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  // Ensure window focus on mount to mitigate Wails frameless window focus lag
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      typeof window.focus === 'function' &&
      typeof navigator !== 'undefined' &&
      !navigator.userAgent.includes('jsdom')
    ) {
      try {
        window.focus();
      } catch {
        // Ignore in restricted environments
      }
    }
  }, []);

  const handleKeyDown = useCallback((e: Event) => {
    const event = e as KeyboardEvent;
    if (event.defaultPrevented) {
      return;
    }

    const isInsideEditable = isEditableElement(event.target);

    for (const shortcut of shortcutsRef.current) {
      if (matchesShortcut(event, shortcut)) {
        // If focus is inside an input/textarea/editor, only allow global shortcuts (allowInEditable)
        if (isInsideEditable && !shortcut.allowInEditable) {
          continue;
        }

        event.preventDefault();
        shortcut.handler(event);
        break;
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const eventTarget = target ?? (typeof window !== 'undefined' ? window : null);
    if (!eventTarget) return;

    eventTarget.addEventListener('keydown', handleKeyDown as EventListener);
    return () => {
      eventTarget.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [enabled, target, handleKeyDown]);
}

/**
 * Convenient alias for useKeyboardShortcuts.
 */
export const useHotkeys = useKeyboardShortcuts;
