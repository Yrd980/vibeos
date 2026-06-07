import DOMPurify from 'dompurify';

const SAFE_CLASSES = new Set([
  'v-app',
  'v-toolbar',
  'v-row',
  'v-col',
  'v-card',
  'v-title',
  'v-muted',
  'v-button',
  'v-primary',
  'v-danger',
  'v-input',
  'v-textarea',
  'v-list',
  'v-list-item',
  'v-grid',
  'v-calc',
  'v-display',
  'v-terminal',
  'v-browser',
  'v-explorer',
  'v-encarta',
  'v-paint',
  'v-settings',
  'v-menu',
  'v-menubar',
  'v-table',
  'v-status',
  'v-status-bar',
  'v-chip',
  'v-canvas',
  'v-canvas-stage',
  'v-dot',
  'v-stroke',
  'v-shape',
  'v-palette',
  'v-swatch',
  'v-split',
  'v-panel',
  'v-keypad',
  'v-address',
  'v-output',
  'v-tool-button',
  'v-toolbar-group',
  'v-ledger',
  'v-ledger-row',
  'v-finance',
  'v-balance',
  'v-search-results',
  'v-search-result',
  'v-article',
  'v-article-title',
  'v-sidebar',
  'v-wizard',
  'v-step',
  'v-progress',
  'v-progress-bar',
  'v-desktop',
  'v-window',
  'v-window-title',
  'v-taskbar',
  'v-icon',
  'v-generated'
]);

let hooksInstalled = false;

export function sanitizeModelHtml(html: string): string {
  installHooks();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'article',
      'aside',
      'button',
      'code',
      'div',
      'footer',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'header',
      'input',
      'label',
      'li',
      'main',
      'ol',
      'option',
      'p',
      'pre',
      'section',
      'select',
      'span',
      'strong',
      'em',
      'table',
      'tbody',
      'td',
      'textarea',
      'th',
      'thead',
      'tr',
      'ul'
    ],
    ALLOWED_ATTR: [
      'aria-label',
      'checked',
      'class',
      'data-vibe-action',
      'data-vibe-field',
      'data-vibe-id',
      'data-vibe-value',
      'disabled',
      'placeholder',
      'role',
      'selected',
      'type',
      'value'
    ],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'svg', 'math'],
    FORBID_ATTR: ['style', 'href', 'src', 'srcset', 'action', 'formaction', 'poster', 'srcdoc'],
    SANITIZE_NAMED_PROPS: true
  });
}

function installHooks(): void {
  if (hooksInstalled) {
    return;
  }
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    const name = data.attrName.toLowerCase();
    if (name.startsWith('on')) {
      data.keepAttr = false;
      return;
    }
    if (data.attrValue.length > 10000) {
      data.keepAttr = false;
      return;
    }
    if (name === 'class') {
      data.attrValue = data.attrValue
        .split(/\s+/)
        .filter((className) => SAFE_CLASSES.has(className))
        .join(' ');
      if (!data.attrValue) {
        data.keepAttr = false;
      }
      return;
    }
    if (name === 'type') {
      const safeInputTypes = new Set(['text', 'search', 'email', 'number', 'checkbox', 'radio']);
      if (!safeInputTypes.has(data.attrValue.toLowerCase())) {
        data.attrValue = 'text';
      }
    }
  });
  hooksInstalled = true;
}
