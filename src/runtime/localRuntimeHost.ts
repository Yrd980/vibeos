import type { LaunchIntent, LocalAppState } from './types';

export function createLocalRuntimeState(intent: LaunchIntent): LocalAppState {
  if (intent.targetHint === 'notepad') {
    return {
      type: 'notepad',
      text: 'VibeOS Notepad\r\n\r\nThis local app never calls a model for typing.',
    };
  }

  return {
    type: 'calculator',
    display: '0',
    expression: '',
  };
}

export function pressLocalCalculator(app: LocalAppState | undefined, key: string) {
  if (!app || app.type !== 'calculator') return;

  if (key === 'C') {
    app.display = '0';
    app.expression = '';
    return;
  }

  if (key === '=') {
    app.display = computeSimpleExpression(app.expression || app.display);
    app.expression = app.display === 'Error' ? '' : app.display;
    return;
  }

  if (key === '+/-') {
    app.display = app.display.startsWith('-') ? app.display.slice(1) : `-${app.display}`;
    app.expression = app.display;
    return;
  }

  const nextExpression = `${app.expression}${key}`;
  app.expression = nextExpression;
  app.display = nextExpression;
}

export function changeLocalNotepad(app: LocalAppState | undefined, text: string) {
  if (app?.type === 'notepad') app.text = text;
}

function computeSimpleExpression(expression: string) {
  const match = expression.match(/^\s*(-?\d+(?:\.\d+)?)([+\-*/])(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return expression || '0';

  const left = Number(match[1]);
  const right = Number(match[3]);
  const op = match[2];
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 'Error';
  if (op === '/' && right === 0) return 'Error';

  const result = op === '+' ? left + right : op === '-' ? left - right : op === '*' ? left * right : left / right;
  return Number.isInteger(result) ? String(result) : String(Number(result.toFixed(8)));
}
