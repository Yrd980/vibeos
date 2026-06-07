import { useEffect, useRef } from 'react';
import type { AppEvent, GeneratedUiAction, GeneratedUiBlock, GeneratedUiField } from '../../shared/types';
import { SAFE_CLASS_NAME_SET } from '../utils/generatedUiVocabulary';

interface AppViewportProps {
  blocks: GeneratedUiBlock[];
  loading: boolean;
  onEvent(event: AppEvent): void;
}

export default function AppViewport({ blocks, loading, onEvent }: AppViewportProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputTimers = useRef(new Map<string, number>());
  const onEventRef = useRef(onEvent);

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
      <div ref={rootRef} className="generated-surface">
        {blocks.map((block) => (
          <GeneratedBlockView block={block} key={block.id} />
        ))}
      </div>
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

function GeneratedBlockView({ block }: { block: GeneratedUiBlock }): React.JSX.Element {
  return (
    <section
      className={blockClassName(block)}
      data-vibe-block-id={block.id}
      data-vibe-block-role={block.role}
    >
      {block.title ? <h1>{block.title}</h1> : null}
      {block.text ? <p className={block.role === 'status' ? 'v-muted' : undefined}>{block.text}</p> : null}
      {block.actions?.length ? (
        <div className={block.role === 'menubar' ? 'v-menubar' : 'v-toolbar'}>
          {block.actions.map((action) => (
            <ActionButton action={action} key={action.id} />
          ))}
        </div>
      ) : null}
      {block.fields?.length ? (
        <div className="v-row">
          {block.fields.map((field) => (
            <GeneratedField field={field} key={`${field.id}-${field.value}`} />
          ))}
        </div>
      ) : null}
      {block.items?.length ? (
        <ul className="v-list">
          {block.items.map((item) => (
            <li className="v-list-item" key={item}>
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {block.table ? (
        <table className="v-table">
          <thead>
            <tr>
              {block.table.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.table.rows.map((row, rowIndex) => (
              <tr key={`${block.id}-${rowIndex}`}>
                {block.table?.columns.map((column, columnIndex) => (
                  <td key={`${column}-${columnIndex}`}>{row[columnIndex] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

function ActionButton({ action }: { action: GeneratedUiAction }): React.JSX.Element {
  return (
    <button
      className={actionClassName(action)}
      data-vibe-action={action.id}
      data-vibe-id={action.id}
      data-vibe-value={action.value ?? action.label}
      type="button"
    >
      {action.label}
    </button>
  );
}

function GeneratedField({ field }: { field: GeneratedUiField }): React.JSX.Element {
  if (field.multiline) {
    return (
      <textarea
        aria-label={field.label}
        className="v-textarea"
        data-vibe-field={field.label}
        data-vibe-id={field.id}
        defaultValue={field.value}
        placeholder={field.placeholder}
      />
    );
  }

  return (
    <input
      aria-label={field.label}
      className="v-input"
      data-vibe-field={field.label}
      data-vibe-id={field.id}
      defaultValue={field.value}
      placeholder={field.placeholder}
    />
  );
}

function blockClassName(block: GeneratedUiBlock): string {
  const base = ['v-block'];
  if (block.className && isSafeGeneratedClassName(block.className)) {
    base.push(block.className);
  } else if (block.role === 'main') {
    base.push('v-app');
  } else if (block.role === 'panel' || block.role === 'sidebar') {
    base.push('v-panel');
  } else if (block.role === 'status') {
    base.push('v-status-bar');
  }
  return base.join(' ');
}

function actionClassName(action: GeneratedUiAction): string {
  if (action.variant === 'primary') {
    return 'v-button v-primary';
  }
  if (action.variant === 'danger') {
    return 'v-button v-danger';
  }
  return 'v-button';
}

function isSafeGeneratedClassName(className: string): boolean {
  return className.split(/\s+/).every((candidate) => SAFE_CLASS_NAME_SET.has(candidate));
}
