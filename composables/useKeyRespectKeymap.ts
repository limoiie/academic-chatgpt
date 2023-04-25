const KEYMAP_EMACS: {
  move: { [key: string]: string };
  edit: { [key: string]: string };
  modifier: { [key: string]: string };
} = {
  move: {
    'Ctrl-b': 'ArrowLeft',
    'Ctrl-f': 'ArrowRight',
    'Ctrl-p': 'ArrowUp',
    'Ctrl-n': 'ArrowDown',
    'Ctrl-a': 'Home',
    'Ctrl-e': 'End',
    'Alt-v': 'PageUp',
    'Ctrl-v': 'PageDown',
    'Alt-b': 'WordLeft',
    'Alt-f': 'WordRight',
    'Alt-ArrowLeft': 'WordLeft',
    'Alt-ArrowRight': 'WordRight',
    'Alt-ArrowUp': 'PageUp',
    'Alt-ArrowDown': 'PageDown',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    WordLef: 'WordLeft',
    WordRight: 'WordRight',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
  },
  edit: {
    'Ctrl-d': 'Delete',
    'Ctrl-h': 'Backspace',
    'Ctrl-k': 'DeleteLine',
    'Ctrl-y': 'Paste',
    'Ctrl-w': 'Cut',
    'Ctrl-t': 'Swap',
    Delete: 'Delete',
    Backspace: 'Backspace',
    DeleteLine: 'DeleteLine',
    Paste: 'Paste',
    Cut: 'Cut',
    Swap: 'Swap',
  },
  modifier: {
    'Ctrl-': 'Ctrl',
    'Meta-': 'Meta',
    'Alt-': 'Alt',
    'Ctrl-Meta-': 'Ctrl-Meta',
    'Ctrl-Alt-': 'Ctrl-Alt',
    'Meta-Alt': 'Meta-Alt'
  },
};

type KeyType = 'move' | 'edit' | 'modifier';
const KEY_TYPES: KeyType[] = ['move', 'edit', 'modifier'];

const MODIFIER_KEYS = ['Control', 'Alt', 'Shift', 'Meta', 'CapsLock'];

export function useKeyRespectKeymap(e: KeyboardEvent) {
  const modifiedKey = modifyKey(e);
  for (const type of KEY_TYPES) {
    const keyTable = KEYMAP_EMACS[type];
    if (keyTable[modifiedKey]) {
      return {
        type,
        key: keyTable[modifiedKey] as string,
      };
    }
  }
  return {
    type: null,
    key: null,
  };
}

/**
 * Modify key with modifiers.
 */
export function modifyKey(e: KeyboardEvent) {
  const key = canonicalizeKey(e);
  return [e.ctrlKey ? 'Ctrl-' : '', e.metaKey ? 'Meta-' : '', e.altKey ? 'Alt-' : '', key].join('');
}

/**
 * Convert key event to canonical key name.
 */
export function canonicalizeKey(e: KeyboardEvent) {
  if (e.code.startsWith('Key') && e.code.length === 4) {
    const char = e.code.slice(3);
    return e.shiftKey ? char.toUpperCase() : char.toLowerCase();
  }
  if (MODIFIER_KEYS.includes(e.key)) {
    return '';
  }
  return e.key;
}
