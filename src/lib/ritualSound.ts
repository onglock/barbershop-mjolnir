/**
 * Звуки ритуала (§10.2, задача A): сэмплы вместо синтеза.
 *
 * Два сэмпла лежат в `public/sounds/` и оба CC0:
 *   • hammer-catch.mp3 — удар молота по наковальне (Anvil Hit 1, michorvath,
 *     Freesound #270589), звук активации ритуала;
 *   • thunder.mp3 — далёкий раскат (Blast of thunder. Rolling thunder,
 *     carthny, Freesound #494027), звук наведения на активированную кнопку.
 *
 * Правила:
 *   • первый звук возможен только после первого жеста пользователя — до этого
 *     `play()` молча отклоняется, и это нормально (политика автозапуска);
 *   • гром не чаще одного раза в 2 с и на громкости 0.3;
 *   • при `prefers-reduced-motion` и на тач-устройствах гром не играет вовсе.
 */

const SRC = {
  catch: '/sounds/hammer-catch.mp3',
  thunder: '/sounds/thunder.mp3'
} as const;

/** Громкость грома — «чтобы не било по ушам». Настраивается здесь. */
export const THUNDER_VOLUME = 0.3;
/** Пауза между раскатами, мс. */
export const THUNDER_COOLDOWN_MS = 2000;

let catchSound: HTMLAudioElement | null = null;
let thunderSound: HTMLAudioElement | null = null;
let lastThunder = 0;
let gestureSeen = false;

function make(src: string, volume: number): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  const el = new Audio(src);
  el.preload = 'auto';
  el.volume = volume;
  return el;
}

function canHover(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function isReduced(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Звук наведения уместен только на устройствах с курсором и без запроса покоя. */
export function thunderAllowed(): boolean {
  return !isReduced() && canHover();
}

export function isAudioReady(): boolean {
  return gestureSeen;
}

/** Первый жест снимает запрет автозапуска: до него ни один звук не играет. */
function markGesture(): void {
  gestureSeen = true;
  catchSound?.load?.();
  thunderSound?.load?.();
}

/**
 * Готовит звуки и ждёт первого жеста: pointerdown или keydown в любом месте.
 * Вызывается один раз при инициализации.
 */
export function armRitualSound(): void {
  if (typeof window === 'undefined' || catchSound) return;
  catchSound = make(SRC.catch, 0.9);
  thunderSound = make(SRC.thunder, THUNDER_VOLUME);
  const onGesture = (): void => markGesture();
  window.addEventListener('pointerdown', onGesture, { once: true, capture: true });
  window.addEventListener('keydown', onGesture, { once: true, capture: true });
}

function play(el: HTMLAudioElement | null): void {
  if (!el || !gestureSeen) return;
  try {
    el.currentTime = 0;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => undefined);
  } catch {
    /* тишина — это допустимый исход, а не ошибка */
  }
}

/** Удар молота: момент активации ритуала. */
export function playHammerCatch(): void {
  play(catchSound);
}

/** Раскат грома: наведение на активированную кнопку, не чаще одного раза в 2 с. */
export function playThunder(): boolean {
  if (!thunderAllowed()) return false;
  const now = Date.now();
  if (now - lastThunder < THUNDER_COOLDOWN_MS) return false;
  lastThunder = now;
  play(thunderSound);
  return true;
}
