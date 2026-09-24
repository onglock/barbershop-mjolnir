/**
 * Пиксельные зазоры Hero: H1 → подзаголовок → кнопка → водяной знак.
 *
 * Зачем модуль. Автополя (`margin-top: auto`) делят свободную высоту между
 * БОКСАМИ элементов, а буквы боксов не заполняют: рамка строчного бокса выше
 * верхушек глифов, у H1 точка свешивается ниже базовой линии. Поэтому
 * «математически равные» зазоры выглядят неравными. Здесь зазоры считаются
 * по КРАСКЕ (глифам), а не по боксам.
 *
 * Как измеряется краска. Строка растеризуется в закадровый canvas тем же
 * шрифтом и кеглем (×4 для точности), затем по строкам растра ищется первая и
 * последняя строка с непрозрачными пикселями — это и есть верх/низ глифов
 * (тот самый «canvas + поиск непрозрачных строк», а не замер бокса).
 * Положение базовой линии берётся из раскладки: верх области содержимого
 * строки (rect первого символа строки, который движок отдаёт для строчного
 * бокса) + восхождение шрифта. Сверено с настоящими кадрами страницы
 * (скриншоты через CDP и разница кадров «цвет погашен / цвет включён»):
 * подзаголовок и знак — расхождение ≤0.1px, H1 — ≤1px по медиане верхушек.
 *
 * Ограничение: предполагается, что строка набрана шрифтом самого элемента
 * (наследование). Если у ребёнка свой шрифт, его краска измерится неверно.
 */

const ALPHA = 24; // порог «непрозрачного» пикселя растра
const SUPERSAMPLE = 4; // кратность растеризации: при 24px кегле это 96px

export type InkBox = { top: number; bottom: number; lines: string[] };

export type HeroGaps = {
  /** три визуальных зазора по глифам, px (округлённые — для показа) */
  a: number;
  b: number;
  c: number;
  /** сырые (дробные) значения — для расчёта */
  raw: { a: number; b: number; c: number };
  /** опорные линии, по которым строятся маркеры отладки (координаты вьюпорта, px) */
  lines: {
    h1InkBottom: number;
    subInkTop: number;
    subInkBottom: number;
    ctaTop: number;
    ctaBottom: number;
    signInkTop: number;
  };
  /** дробные поправки «бокс → краска», на которых держится равенство зазоров */
  offsets: { h1BelowGlyphs: number; subAboveGlyphs: number; subBelowGlyphs: number; signAboveGlyphs: number };
  /** свободная высота, которую делят три зазора, и поставленные значения */
  free: number;
  applied: { a: number; b: number; c: number } | null;
  /** удалось ли сделать три зазора равными */
  fits: boolean;
  blocked: string | null;
  mode: 'pixel' | 'fixed' | 'boxes';
};

const clampNum = (v: number) => Math.round(v * 100) / 100;

function canvasFont(cs: CSSStyleDeclaration, sizePx: number) {
  return `${cs.fontStyle} ${cs.fontWeight} ${sizePx}px ${cs.fontFamily}`;
}

/** Метрики шрифта: восхождение и нисхождение (px для данного кегля). */
function fontMetrics(cs: CSSStyleDeclaration, sizePx: number) {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = canvasFont(cs, sizePx);
  const m = ctx.measureText('ЁМХ');
  return {
    ascent: m.fontBoundingBoxAscent || sizePx * 0.86,
    descent: m.fontBoundingBoxDescent || sizePx * 0.24,
  };
}

/** Верх и низ краски строки относительно базовой линии (по растру canvas). */
const inkCache = new Map<string, { ascent: number; descent: number } | null>();

function lineInk(text: string, cs: CSSStyleDeclaration, sizePx: number) {
  const font = canvasFont(cs, sizePx);
  const key = font + '|' + text;
  const hit = inkCache.get(key);
  if (hit !== undefined) return hit;
  const k = SUPERSAMPLE;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const size = sizePx * k;
  ctx.font = canvasFont(cs, size);
  const width = Math.ceil(ctx.measureText(text).width) + 8 * k;
  const height = Math.ceil(size * 3);
  canvas.width = width;
  canvas.height = height;
  ctx.font = canvasFont(cs, size);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  const baseline = Math.round(height / 2);
  ctx.fillText(text, 4 * k, baseline);

  const data = ctx.getImageData(0, 0, width, height).data;
  let first = -1;
  let last = -1;
  for (let y = 0; y < height; y++) {
    let hasInk = false;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA) {
        hasInk = true;
        break;
      }
    }
    if (hasInk) {
      if (first < 0) first = y;
      last = y;
    }
  }
  const out = first < 0 ? null : { ascent: (baseline - first) / k, descent: (last - baseline) / k };
  inkCache.set(key, out);
  return out;
}

/**
 * Разбивка текста элемента по строкам — кешируется.
 * Проход по символам с `range.getBoundingClientRect()` на каждом символе стоит
 * ~0.3 с на элемент (принудительный пересчёт раскладки), а меняется только при
 * смене кегля/ширины и текста, поэтому держим результат в WeakMap.
 */
const linesCache = new WeakMap<HTMLElement, { key: string; rows: string[] }>();

function textRows(el: HTMLElement, cs: CSSStyleDeclaration, lineHeight: number) {
  const key = [cs.fontSize, cs.lineHeight, el.clientWidth, el.textContent?.length ?? 0].join('|');
  const hit = linesCache.get(el);
  if (hit && hit.key === key) return hit.rows;
  const chars: { ch: string; top: number; left: number }[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node = walker.nextNode() as Text | null;
  while (node) {
    const data = node.data;
    for (let i = 0; i < data.length; i++) {
      if (!data[i].trim()) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect();
      if (r.height) chars.push({ ch: data[i], top: r.top, left: r.left });
    }
    node = walker.nextNode() as Text | null;
  }
  if (!chars.length) return [];
  const firstTop = chars[0].top;
  const buckets = new Map<number, { ch: string; top: number; left: number }[]>();
  for (const c of chars) {
    const idx = Math.max(0, Math.round((c.top - firstTop) / lineHeight));
    const bucket = buckets.get(idx) ?? [];
    bucket.push(c);
    buckets.set(idx, bucket);
  }
  const rows = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, bucket]) => bucket.sort((a, b) => a.left - b.left).map((c) => c.ch).join(''));
  linesCache.set(el, { key, rows });
  return rows;
}

/**
 * Краска элемента: верх и низ глифов по всем его строкам.
 *
 * Базовая линия берётся из БОКСА элемента (верх + полулидинг + восхождение
 * шрифта), а не из rect символов: у H1 слова обёрнуты в клип-боксы и на входе
 * сцены едут трансформом вниз, поэтому rect символов в первые ~1.2 с после
 * загрузки врёт на целую строку. Бокс же анимация не двигает. Для строчного
 * элемента (span знака) rect и есть область содержимого, там формула проще.
 */
export function inkBox(el: HTMLElement): InkBox | null {
  const cs = getComputedStyle(el);
  const sizePx = parseFloat(cs.fontSize);
  const lineHeight = parseFloat(cs.lineHeight) || sizePx * 1.2;
  const { ascent, descent } = fontMetrics(cs, sizePx);
  const halfLeading = (lineHeight - (ascent + descent)) / 2;

  const box = el.getBoundingClientRect();
  const paddingTop = parseFloat(cs.paddingTop || '0') + parseFloat(cs.borderTopWidth || '0');
  const isInline = cs.display === 'inline';
  const base =
    isInline
      ? box.top + ascent // у строчного элемента rect = область содержимого, базовая ниже её верха на восхождение
      : box.top + paddingTop + halfLeading + ascent;

  /* Строки берём из кеша (см. textRows): проход по символам стоит ~0.3 с. */
  const rows = textRows(el, cs, lineHeight);
  if (!rows.length) return null;

  let top = Infinity;
  let bottom = -Infinity;
  const lines: string[] = [];
  for (let idx = 0; idx < rows.length; idx++) {
    const text = rows[idx];
    lines.push(text);
    const ink = lineInk(text, cs, sizePx);
    if (!ink) continue;
    const baseline = isInline ? base : base + idx * lineHeight;
    top = Math.min(top, baseline - ink.ascent);
    bottom = Math.max(bottom, baseline + ink.descent);
  }
  if (!isFinite(top) || !isFinite(bottom)) return null;
  return { top, bottom, lines };
}

/** Все элементы, между которыми считаются зазоры. */
function parts() {
  const intro = document.querySelector<HTMLElement>('.hero-intro');
  const h1 = document.querySelector<HTMLElement>('.hero-intro h1');
  const sub = document.querySelector<HTMLElement>('.hero-sub');
  const cta = document.querySelector<HTMLElement>('.hero-cta');
  const decor = document.querySelector<HTMLElement>('.hero-decor.decor-2');
  const sign = decor?.querySelector<HTMLElement>('span') ?? null;
  if (!intro || !h1 || !sub || !cta || !decor || !sign) return null;
  return { intro, h1, sub, cta, decor, sign };
}

/** Замер трёх зазоров по краске + геометрия, нужная для расчёта отступов. */
export function measureHero(): HeroGaps | null {
  const p = parts();
  if (!p) return null;
  const h1Ink = inkBox(p.h1);
  const subInk = inkBox(p.sub);
  const signInk = inkBox(p.sign);
  if (!h1Ink || !subInk || !signInk) return null;

  const h1r = p.h1.getBoundingClientRect();
  const sr = p.sub.getBoundingClientRect();
  const cr = p.cta.getBoundingClientRect();
  const dr = p.decor.getBoundingClientRect();
  const ir = p.intro.getBoundingClientRect();
  const ics = getComputedStyle(p.intro);
  const subCs = getComputedStyle(p.sub);
  const ctaCs = getComputedStyle(p.cta);
  const decorCs = getComputedStyle(p.decor);
  const h1Cs = getComputedStyle(p.h1);

  const rawA = subInk.top - h1Ink.bottom;
  const rawB = cr.top - subInk.bottom;
  const rawC = signInk.top - cr.bottom;

  // свободная высота: высота контейнера минус всё, кроме трёх наших отступов
  const contentHeight =
    p.intro.clientHeight - parseFloat(ics.paddingTop || '0') - parseFloat(ics.paddingBottom || '0');
  const fixedSpace =
    parseFloat(h1Cs.marginTop || '0') +
    h1r.height +
    parseFloat(subCs.marginBottom || '0') +
    sr.height +
    cr.height +
    dr.height +
    parseFloat(decorCs.marginBottom || '0');
  const free = contentHeight - fixedSpace;

  const mode: HeroGaps['mode'] = document.documentElement.hasAttribute('data-spacing')
    ? 'fixed'
    : document.documentElement.style.getPropertyValue('--hero-gap-a')
      ? 'pixel'
      : 'boxes';
  const va = document.documentElement.style.getPropertyValue('--hero-gap-a');
  const vb = document.documentElement.style.getPropertyValue('--hero-gap-b');
  const vc = document.documentElement.style.getPropertyValue('--hero-gap-c');
  const applied = va && vb && vc ? { a: parseFloat(va), b: parseFloat(vb), c: parseFloat(vc) } : null;

  return {
    a: Math.round(rawA),
    b: Math.round(rawB),
    c: Math.round(rawC),
    raw: { a: clampNum(rawA), b: clampNum(rawB), c: clampNum(rawC) },
    lines: {
      h1InkBottom: h1Ink.bottom,
      subInkTop: subInk.top,
      subInkBottom: subInk.bottom,
      ctaTop: cr.top,
      ctaBottom: cr.bottom,
      signInkTop: signInk.top,
    },
    offsets: {
      h1BelowGlyphs: clampNum(h1r.bottom - h1Ink.bottom),
      subAboveGlyphs: clampNum(subInk.top - sr.top),
      subBelowGlyphs: clampNum(sr.bottom - subInk.bottom),
      signAboveGlyphs: clampNum(signInk.top - dr.top),
    },
    free: clampNum(free),
    applied,
    fits: Math.abs(rawA - rawB) <= 1 && Math.abs(rawB - rawC) <= 1,
    blocked: null,
    mode,
  };
}

/**
 * Пиксельные «Авто-равные»: считает три отступа так, чтобы РАВНЫМИ были
 * зазоры по глифам, и кладёт их в переменные --hero-gap-a|b|c на .hero-intro.
 *
 * Вывод формулы. Пусть m1, m2, m3 — отступы (подзаголовок, кнопка, знак),
 * b1 = «низ бокса H1 минус низ букв», s_t/s_b — «буквы подзаголовка внутри его
 * бокса», d_t — «верх букв знака от верха его бокса». Тогда визуальные зазоры:
 *   A = m1 + s_t + b1,  B = m2 + s_b,  C = m3 + d_t,
 * а сумма отступов равна свободной высоте: m1 + m2 + m3 = S.
 * Приравняв A = B = C = g, получаем g = (S + s_t + b1 + s_b + d_t) / 3 и
 * m1 = g - s_t - b1, m2 = g - s_b, m3 = g - d_t. Высоты элементов от отступов
 * не зависят, поэтому одного замера достаточно — итерации не нужны.
 */
export function applyPixelGaps(): HeroGaps | null {
  /* Узкий экран: знака нет, композиция другая — там правят фиксированные 48px
     из CSS, а переменные должны быть сняты, иначе на них опирается нечего. */
  if (!window.matchMedia('(min-width: 1024px)').matches) {
    clearPixelGaps();
    return null;
  }
  const p = parts();
  if (!p) return null;
  const g = measureHero();
  if (!g) return null;

  // в фиксированных режимах отступы задаёт CSS — переменные не ставим
  if (document.documentElement.hasAttribute('data-spacing')) {
    clearPixelGaps();
    return g;
  }

  const { h1BelowGlyphs: b1, subAboveGlyphs: st, subBelowGlyphs: sb, signAboveGlyphs: dt } = g.offsets;
  const gg = (g.free + st + b1 + sb + dt) / 3;
  const m1 = gg - st - b1;
  const m2 = gg - sb;
  const m3 = gg - dt;

  const fits = m1 >= 0 && m2 >= 0 && m3 >= 0;
  if (!fits) {
    /* Высоты не хватает: равенство по глифам недостижимо (один отступ ушёл бы
       в минус). Тогда отдаём распределение браузеру — равные БОКСОВЫЕ отступы
       (margin-top: auto), как было до пиксельного режима. */
    clearPixelGaps();
    const fallback = measureHero();
    if (fallback) {
      fallback.mode = 'boxes';
      fallback.fits = false;
      fallback.blocked = 'не хватает высоты: считаем по боксам (auto)';
      return fallback;
    }
    return g;
  }
  const clamp = (v: number) => Math.max(0, clampNum(v));
  const root = document.documentElement;
  root.style.setProperty('--hero-gap-a', clamp(m1) + 'px');
  root.style.setProperty('--hero-gap-b', clamp(m2) + 'px');
  root.style.setProperty('--hero-gap-c', clamp(m3) + 'px');

  const after = measureHero();
  if (after) {
    after.mode = 'pixel';
    after.applied = { a: clamp(m1), b: clamp(m2), c: clamp(m3) };
    after.fits = after.fits && fits;
    after.blocked = fits ? null : 'не хватает высоты: точное равенство недостижимо';
    /* Сообщаем наружу: страница-отладка должна показать эти же числа, а сама
       она пересчитывать не обязана (иначе получился бы цикл пересчётов). */
    root.dispatchEvent(new CustomEvent('hero:gaps', { detail: after }));
    return after;
  }
  return g;
}

export function clearPixelGaps() {
  /* Переменные живут на <html>, а не на .hero-intro: тот узел рендерит React,
     и правка его style-атрибута даёт несовпадение гидратации (React логирует
     расхождение). <html> вне React, а переменные всё равно наследуются. */
  const root = document.documentElement;
  root.style.removeProperty('--hero-gap-a');
  root.style.removeProperty('--hero-gap-b');
  root.style.removeProperty('--hero-gap-c');
}

/**
 * Подписка: пересчитывать при смене размера окна, загрузке шрифтов и смене
 * режимов (атрибуты data-spacing / data-sub на <html>).
 */
export function watchHeroGaps(): () => void {
  let raf = 0;
  const run = () => {
    raf = 0;
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      clearPixelGaps();
      return;
    }
    applyPixelGaps();
  };
  const schedule = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(run);
  };

  schedule();
  window.addEventListener('resize', schedule, { passive: true });
  document.fonts?.ready.then(schedule).catch(() => {});
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-spacing', 'data-sub', 'data-decor'],
  });

  /* ResizeObserver на сам контейнер: высота героя меняется не в момент события
     resize, а кадром позже (единицы svh/dvh досчитываются), поэтому замер по
     событию оставался на прежней высоте — зазоры показывались 57 вместо 63.
     Наблюдаем фактический размер и пересчитываем, когда он реально изменился. */
  let lastHeight = -1;
  const resizeObserver = new ResizeObserver((entries) => {
    const height = Math.round(entries[0].contentRect.height);
    if (height === lastHeight) return;
    lastHeight = height;
    schedule();
  });
  const intro = document.querySelector<HTMLElement>('.hero-intro');
  if (intro) resizeObserver.observe(intro);

  return () => {
    window.removeEventListener('resize', schedule);
    observer.disconnect();
    resizeObserver.disconnect();
    if (raf) cancelAnimationFrame(raf);
  };
}
