/**
 * Ритуал на главной: кнопка-молот в шапке (§10.2, задача A).
 *
 * Поведение:
 *   • кнопка кликабельна всегда;
 *   • первый клик ДО ритуала — запускает тему «Кузнечный горн» (1500 мс
 *     расцветание → 1500 мс дыхание → 1200 мс затухание) и звук активации;
 *     после этого кнопка перестаёт быть тусклой;
 *   • повторный клик — плавный скролл к форме записи;
 *   • состояние хранится в localStorage: повторный заход — кнопка сразу активна;
 *   • при `prefers-reduced-motion` ритуал не запускается вовсе, кнопка сразу
 *     активна, звук молчит.
 *
 * Полёт молота (задача B) сюда не входит: сейчас только тема и звук.
 */
import { applyRitual, fadeOutRitual, type RitualVariant } from './ritualEffects';
import { armRitualSound, playHammerCatch, playThunder } from './ritualSound';

/** Тема ритуала. Пока «Кузнечный горн» — выбор Кирилла. */
export const RITUAL_THEME: RitualVariant = 'D';

/** Тайминги: расцветание, дыхание, затухание (мс). */
export const RITUAL_TIMINGS = { bloom: 1500, breathe: 1500, fade: 1200 };

const STORAGE_KEY = 'ritual-done';

function isReduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function stored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function store(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* приватный режим — просто не запомним */
  }
}

function scrollToContact(): void {
  const lenis = (window as unknown as { __lenis?: { scrollTo: (t: string | HTMLElement, o?: object) => void } }).__lenis;
  const target = document.getElementById('contact');
  if (lenis) {
    lenis.scrollTo('#contact');
    return;
  }
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Инициализация: вешается один раз на элемент `[data-ritual-hammer]`.
 * Возвращает функцию снятия обработчиков (нужна только тестам).
 */
export function initRitual(): () => void {
  /* Кнопок в разметке две: десктопная в шапке и компактная для мобильного бара,
     видима всегда ровно одна. Слушатели вешаем на каждую — иначе на телефоне
     тап уходит в кнопку без обработчика. */
  const buttons = Array.from(document.querySelectorAll<HTMLElement>('[data-ritual-hammer]'));
  if (!buttons.length) return () => undefined;

  armRitualSound();

  /* при reduce ритуал не показываем: кнопка сразу активна, звука нет */
  let done = stored() || isReduced();
  let running = false;

  const paint = (): void => {
    for (const button of buttons) button.dataset.state = done ? 'active' : 'idle';
  };
  paint();

  const onClick = (event: MouseEvent): void => {
    if (done) {
      scrollToContact();
      return;
    }
    event.preventDefault();
    if (running) return;
    running = true;

    playHammerCatch(); // звук активации — в первые же миллисекунды расцветания
    applyRitual(RITUAL_THEME);
    const breatheEnd = RITUAL_TIMINGS.bloom + RITUAL_TIMINGS.breathe;
    window.setTimeout(() => fadeOutRitual(RITUAL_TIMINGS.fade), breatheEnd);
    window.setTimeout(() => {
      running = false;
      done = true;
      store();
      paint();
    }, breatheEnd + RITUAL_TIMINGS.fade);
  };

  const onEnter = (): void => {
    /* гром — только на активированной кнопке; частоту и условия держит звуковой модуль */
    if (done && !running) playThunder();
  };

  for (const button of buttons) {
    button.addEventListener('click', onClick);
    button.addEventListener('pointerenter', onEnter);
  }

  return () => {
    for (const button of buttons) {
      button.removeEventListener('click', onClick);
      button.removeEventListener('pointerenter', onEnter);
    }
  };
}
