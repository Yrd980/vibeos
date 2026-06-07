import { useEffect, useMemo, useRef } from 'react';
import type { AppEvent } from '../../shared/types';
import { sanitizeModelHtml } from '../utils/sanitizeHtml';

interface AppViewportProps {
  html: string;
  loading: boolean;
  onEvent(event: AppEvent): void;
}

export default function AppViewport({ html, loading, onEvent }: AppViewportProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputTimers = useRef(new Map<string, number>());
  const onEventRef = useRef(onEvent);
  const cleanHtml = useMemo(() => sanitizeModelHtml(html), [html]);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const getActionElement = (event: Event): Element | null => {
      const target = event.target instanceof Element ? event.target : null;
      const element = target?.closest('[data-vibe-action], button');
      if (!element || !root.contains(element)) {
        return null;
      }
      if (element instanceof HTMLButtonElement && element.disabled) {
        return null;
      }
      return element;
    };

    const handleClick = (event: MouseEvent): void => {
      const element = getActionElement(event);
      if (!element) {
        return;
      }
      event.preventDefault();
      const rect = (element as HTMLElement).getBoundingClientRect();
      onEventRef.current({
        type: 'click',
        targetText: capText(element.getAttribute('data-vibe-value') ?? element.textContent ?? ''),
        targetRole: element.getAttribute('role') ?? element.tagName.toLowerCase(),
        selectorPath: capText(element.getAttribute('data-vibe-id') ?? element.getAttribute('data-vibe-action') ?? ''),
        x: Math.round(event.clientX - rect.left),
        y: Math.round(event.clientY - rect.top)
      });
    };

    const handleInput = (event: Event): void => {
      const target = event.target instanceof Element ? event.target : null;
      const element = target?.closest('[data-vibe-field], input, textarea, select') as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (!element || !root.contains(element)) {
        return;
      }
      const field = element.getAttribute('data-vibe-field') ?? element.getAttribute('aria-label') ?? element.getAttribute('placeholder') ?? element.tagName.toLowerCase();
      const key = element.getAttribute('data-vibe-id') ?? field;
      window.clearTimeout(inputTimers.current.get(key));
      const value = element instanceof HTMLInputElement && element.type === 'checkbox' ? String(element.checked) : element.value;
      inputTimers.current.set(
        key,
        window.setTimeout(() => {
          onEventRef.current({
            type: 'input',
            targetLabel: capText(field),
            selectorPath: capText(key),
            value: value.slice(0, 10000)
          });
        }, 220)
      );
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter') {
        if (event.ctrlKey || event.altKey) {
          onEventRef.current({ type: 'keyboard', key: event.key, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey });
        }
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      const element = target?.closest('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null;
      if (!element || !root.contains(element)) {
        return;
      }
      if (element instanceof HTMLTextAreaElement) {
        return;
      }
      event.preventDefault();
      onEventRef.current({
        type: 'submit',
        formText: capText(element.value),
        values: collectFieldValues(root)
      });
    };

    root.addEventListener('click', handleClick, true);
    root.addEventListener('input', handleInput, true);
    root.addEventListener('change', handleInput, true);
    root.addEventListener('keydown', handleKeyDown, true);
    return () => {
      root.removeEventListener('click', handleClick, true);
      root.removeEventListener('input', handleInput, true);
      root.removeEventListener('change', handleInput, true);
      root.removeEventListener('keydown', handleKeyDown, true);
      for (const timer of inputTimers.current.values()) {
        window.clearTimeout(timer);
      }
      inputTimers.current.clear();
    };
  }, []);

  return (
    <div className="app-viewport">
      {loading ? <div className="viewport-loading">AI refining...</div> : null}
      <div ref={rootRef} className="generated-surface" dangerouslySetInnerHTML={{ __html: cleanHtml }} />
    </div>
  );
}

function collectFieldValues(root: HTMLElement): Record<string, string> {
  const values: Record<string, string> = {};
  const fields = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');
  for (const field of fields) {
    const key = field.getAttribute('data-vibe-field') ?? field.getAttribute('aria-label') ?? field.name ?? field.tagName.toLowerCase();
    values[capText(key)] = field instanceof HTMLInputElement && field.type === 'checkbox' ? String(field.checked) : field.value.slice(0, 10000);
  }
  return values;
}

function capText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 240);
}
