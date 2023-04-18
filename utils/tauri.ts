export function isInTauri() {
  return window.hasOwnProperty('__TAURI__');
}

export const IN_TAURI = isInTauri();
