/* Original map-tool illustrations; their motion and palette belong to the UI. */
window.bagelToolIcons = Object.freeze({
  search: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="m9 16 13-5 12 5 12-4 1 35-13 5-12-6-13 4Z" fill="var(--tool-icon-fill)"/>
    <path d="M22 11v35m12-30v36M13 23l5-2m-5 8 5-2m-5 8 5-2m23-10 2-1" opacity=".6"/>
    <path d="m16 41 11-11 8 3 6-9" stroke="var(--tool-icon-accent)" stroke-dasharray="2 4"/>
    <g class="tool-icon-part">
      <path d="m43 39 12 11a4 4 0 0 1-6 6L38 44Z" fill="var(--tool-icon-fill)"/>
      <circle cx="36" cy="32" r="13" fill="var(--tool-icon-fill)"/>
      <circle cx="36" cy="32" r="8.5" stroke="var(--tool-icon-accent)"/>
      <path d="M32 27a6 6 0 0 1 4-1m-5 4v1"/>
    </g>
    <path class="tool-icon-signal" d="M49 13v6m-3-3h6" stroke="var(--tool-icon-accent)"/>
  </svg>`,
  route: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="m6 21 16-6 17 5 15-7 4 36-17 8-18-5-17 5Z" fill="var(--tool-icon-fill)"/>
    <path d="m22 15 1 37m16-32 2 37M10 28l8-3m-7 8 7-3m27 16 8-4m-7 9 8-4" opacity=".55"/>
    <path class="tool-icon-part" d="M15 45c-3-12 13-3 14-14s12-6 18-11" stroke="var(--tool-icon-accent)" stroke-width="3" stroke-dasharray="3 5"/>
    <circle cx="15" cy="45" r="3" fill="var(--tool-icon-accent)"/>
    <g class="tool-icon-part">
      <path d="M50 17c4-4 6-7 6-10a7 7 0 0 0-14 0c0 3 3 7 8 10Z" transform="translate(-2 5)" fill="var(--tool-icon-fill)"/>
      <circle cx="47" cy="12" r="2.4" fill="var(--tool-icon-accent)" stroke="none"/>
    </g>
  </svg>`,
  spawn: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="m8 46 22-8 25 8v7l-22 7-25-7Z" fill="var(--tool-icon-fill)"/>
    <path d="m8 46 25 8 22-8M33 54v6"/>
    <ellipse cx="32" cy="44" rx="14" ry="5" stroke="var(--tool-icon-accent)"/>
    <path d="M14 43V19l7-4v7l-2 2v17m26-2V20l-3-2v-7l8 5v28" fill="var(--tool-icon-fill)"/>
    <g class="tool-icon-part">
      <path d="M32 36c-4-5-11-11-11-18a11 11 0 1 1 22 0c0 7-7 13-11 18Z" fill="var(--tool-icon-fill)"/>
      <path d="m32 12 5 5-5 5-5-5Z" fill="var(--tool-icon-accent)"/>
    </g>
    <path class="tool-icon-signal" d="M32 41v3m-7-3 2 2m12-2-2 2M10 9v5m-2-2h4" stroke="var(--tool-icon-accent)"/>
  </svg>`,
  exit: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="m8 14 27-7 11 6v35l-11 8-27-7Z" fill="var(--tool-icon-fill)"/>
    <path d="M35 7v49M13 18l16-4v34l-16-4Z"/>
    <path d="m18 22 11-3v29l-11-7Z" fill="var(--tool-icon-accent)" opacity=".65"/>
    <path d="M24 32v3m-12 21 22 6 17-10"/>
    <g class="tool-icon-part">
      <path d="M36 27h10v-6l12 12-12 12v-6H36Z" fill="var(--tool-icon-accent)"/>
      <path d="M32 30h-3m3 6h-5"/>
    </g>
    <path class="tool-icon-signal" d="m44 7 3-3m3 8h4" stroke="var(--tool-icon-accent)"/>
  </svg>`,
  gallery: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="m13 11 34-5 6 42-34 8a6 6 0 0 1-7-5L7 19a7 7 0 0 1 6-8Z" fill="var(--tool-icon-fill)"/>
    <path d="m13 11 6 38m-6-1 33-7 1 6-29 7m1-5 31-7M51 47l3 6-32 7a7 7 0 0 1-8-5" fill="var(--tool-icon-fill)"/>
    <path d="m20 16 20-3m-16 27 15-3" opacity=".6"/>
    <g class="tool-icon-part">
      <path d="m23 23 10-5 12 5-10 6Z" fill="var(--tool-icon-fill)"/>
      <path d="M23 23v11l12 5 10-6V23l-10 6Z" fill="var(--tool-icon-fill)"/>
      <path d="M35 29v10m-7-18 11 5v5l-4 2v-4" stroke="var(--tool-icon-accent)"/>
    </g>
    <path class="tool-icon-signal" d="M53 10v6m-3-3h6" stroke="var(--tool-icon-accent)"/>
  </svg>`,
  sources: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="m8 22 38-6 11 34-38 9Z" fill="var(--tool-icon-fill)"/>
    <path d="m6 17 39-5 9 34-39 8Z" fill="var(--tool-icon-fill)"/>
    <g class="tool-icon-part">
      <path d="m11 9 37-3 6 35-37 7Z" fill="var(--tool-icon-fill)"/>
      <path d="m24 8 5 38M37 7l6 36" opacity=".55"/>
      <path d="m16 21 10-5 6 8 7-3 11 7"/>
      <path d="m19 37 9-7 7 3 7-9 7-3" stroke="var(--tool-icon-accent)" stroke-dasharray="2 4"/>
      <circle cx="19" cy="37" r="2" fill="var(--tool-icon-accent)" stroke="none"/>
      <circle cx="48" cy="21" r="2" fill="var(--tool-icon-accent)" stroke="none"/>
    </g>
    <path d="m34 48 3 8 5-5 6 3-3-9" fill="var(--tool-icon-accent)"/>
    <path class="tool-icon-signal" d="M6 6v5m-2-2h4" stroke="var(--tool-icon-accent)"/>
  </svg>`
});
