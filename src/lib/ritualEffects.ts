/**
 * Темы ритуала (§10.2) — пять визуальных состояний страницы после клика по CTA.
 *
 * Демо-модуль для dev-страницы `/ritual-demo`. Эффекты полностью синтетические:
 * CSS-слои (градиенты + blur) и частицы на canvas. Внешних ассетов нет.
 *
 * Цвета эффектов заданы литералами осознанно: это не UI-палитра, а «погода»
 * темы (мороз, сияние, горн), и они не должны попадать в дизайн-токены §11.
 * Разметка демо-страницы при этом берёт цвета только из токенов.
 *
 * prefers-reduced-motion: движение отключается полностью — остаётся статичный
 * кадр темы (один проход отрисовки, ни одного rAF и ни одной анимации).
 */

export type RitualVariant = 'A' | 'B' | 'C' | 'D' | 'E';

/** Кубические кривые в виде функций прогресса (правка 2026-09-21). */
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Руны Эльдера, нарисованные штрихами: [x1,y1]-[x2,y2] в квадрате 0..1. */
const RUNES: [number, number][][][] = [
  [[[0.5, 0], [0.5, 1]], [[0.5, 0], [1, 0.22]], [[0.5, 0.42], [1, 0.64]]],
  [[[0.2, 1], [0.2, 0]], [[0.2, 0], [1, 0.35]], [[0.2, 1], [1, 0.65]]],
  [[[0.2, 0], [0.2, 1]], [[0.2, 0.35], [1, 0]]],
  [[[0.2, 0], [0.2, 1]], [[0.2, 0.5], [1, 0]], [[0.2, 0.5], [1, 1]]],
  [[[0.2, 0], [0.2, 1]], [[0.2, 0], [0.75, 0.5]], [[0.2, 1], [0.75, 0.5]], [[0.75, 0.5], [1, 0.5]]],
  [[[0.15, 1], [0.5, 0]], [[0.5, 0], [0.85, 1]]],
  [[[0.5, 0], [0.5, 1]], [[0.5, 0], [0.85, 0.4]], [[0.85, 0.4], [0.5, 0.7]]],
  [[[0.85, 0], [0.15, 0.5]], [[0.85, 0], [0.15, 1]]],
  [[[0.5, 0], [0.5, 1]]],
  [[[0.5, 0], [0.5, 0.75]], [[0.5, 0.75], [0.15, 1]], [[0.5, 0.75], [0.85, 1]]]
];

interface Particle {
  x: number; y: number; r: number; p: number; s: number;
  v?: number; l?: number; w?: number; o?: number; d?: number; a?: number; hot?: number;
  rune?: [number, number][][]; sc?: number; rot?: number;
  /* горн: каскад по времени старта и полёт с замедлением */
  y0?: number; x0?: number; born?: number; life?: number; rise?: number;
}

type ParticleKind = 'rain' | 'stars' | 'crystals' | 'sparks' | 'runes';

const HOST_ID = 'ritualfx';
const STYLE_FLAG = 'ritual';
/** выход темы: медленный старт, быстрый финал (ease-in-cubic) */
export const FADE_OUT_MS = 1200;

interface RitualHost extends HTMLDivElement {
  __raf?: number;
  __timers?: number[];
  __style?: HTMLStyleElement;
}

let activeHost: RitualHost | null = null;
const dyingHosts = new Set<RitualHost>();

function isReduced(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function layer(css: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;inset:0;${css}`;
  return el;
}

function injectKeyframes(css: string): HTMLStyleElement {
  const tag = document.createElement('style');
  tag.setAttribute(`data-${STYLE_FLAG}`, '1');
  tag.textContent = css;
  document.head.appendChild(tag);
  return tag;
}

function disposeHost(host: RitualHost | null): void {
  if (!host) return;
  if (host.__raf) cancelAnimationFrame(host.__raf);
  (host.__timers ?? []).forEach((t) => window.clearTimeout(t));
  host.__style?.remove();
  host.remove();
  dyingHosts.delete(host);
  if (activeHost === host) activeHost = null;
}

/** Гасит текущую тему мгновенно (reduce и внутренние нужды). */
export function removeRitual(): void {
  disposeHost(activeHost);
  for (const h of Array.from(dyingHosts)) disposeHost(h);
}

/** Гасит тему плавно: слои уходят за ms по ease-in-cubic, а не «щёлк». */
export function fadeOutRitual(ms: number = FADE_OUT_MS): void {
  const host = activeHost;
  if (!host) return;
  if (isReduced()) {
    disposeHost(host);
    return;
  }
  activeHost = null;
  dyingHosts.add(host);
  host.id = '';
  host.__style?.appendChild(document.createTextNode('@keyframes rf-dimout{0%{opacity:1}100%{opacity:0}}'));
  host.style.animation = `rf-dimout ${ms}ms cubic-bezier(.32,0,.67,0) both`;
  const t = window.setTimeout(() => disposeHost(host), ms + 80);
  host.__timers = [...(host.__timers ?? []), t];
}

/** Включает тему. Повторный вызов (в т.ч. для той же темы) — перезапуск с нуля. */
export function applyRitual(variant: RitualVariant): void {
  fadeOutRitual(); // прежняя тема уходит мягко, новая расцветает поверх
  const reduce = isReduced();
  const host = document.createElement('div') as RitualHost;
  host.id = HOST_ID;
  host.style.cssText = 'position:fixed;inset:0;z-index:45;pointer-events:none;overflow:hidden';
  host.__timers = [];
  document.body.appendChild(host);
  activeHost = host;

  let css = '@keyframes rf-dimin{0%{opacity:0}100%{opacity:1}}';

  /* затемнение под текст: держит контраст заголовков ≥ 6,3:1 (замерено).
     Проявляется за 800 мс, а не появляется рывком. */
  const dim = variant === 'C' ? 0.24 : variant === 'B' ? 0.34 : 0.3;
  host.appendChild(layer(`background:rgba(3,6,9,${dim});opacity:0;animation:rf-dimin 800ms ease-out both`));

  let particles: ParticleKind | null = null;

  if (variant === 'A') {
    css += '@keyframes rf-drift{0%{transform:translate3d(-4%,0,0) scale(1.1)}100%{transform:translate3d(4%,0,0) scale(1.1)}}';
    host.appendChild(layer(
      'background:radial-gradient(60% 45% at 20% 8%,rgba(28,40,58,.92),transparent 70%),' +
      'radial-gradient(55% 40% at 72% 4%,rgba(22,32,48,.95),transparent 72%),' +
      'radial-gradient(70% 50% at 45% -6%,rgba(14,20,32,.98),transparent 75%);' +
      'filter:blur(18px);animation:rf-drift 9s ease-in-out infinite alternate'));
    host.appendChild(layer('background:radial-gradient(120% 60% at 50% 120%,rgba(10,16,26,.9),transparent 70%)'));
    particles = 'rain';
  } else if (variant === 'B') {
    css += '@keyframes rf-aur1{0%{transform:translate3d(-6%,-2%,0) rotate(-4deg) scaleY(1)}50%{transform:translate3d(4%,2%,0) rotate(3deg) scaleY(1.12)}100%{transform:translate3d(-6%,-2%,0) rotate(-4deg) scaleY(1)}}' +
      '@keyframes rf-aur2{0%{transform:translate3d(5%,3%,0) rotate(5deg) scaleY(1.08)}50%{transform:translate3d(-5%,-3%,0) rotate(-3deg) scaleY(1)}100%{transform:translate3d(5%,3%,0) rotate(5deg) scaleY(1.08)}}';
    host.appendChild(layer(
      'background:linear-gradient(96deg,transparent 8%,rgba(52,226,160,.5) 24%,rgba(88,180,255,.36) 46%,rgba(150,90,240,.22) 62%,transparent 66%);' +
      'mask-image:linear-gradient(to bottom,transparent 4%,#000 34%,#000 78%,transparent 100%);' +
      'animation:rf-aur1 7s ease-in-out infinite;filter:blur(20px);will-change:transform'));
    host.appendChild(layer(
      'background:linear-gradient(78deg,transparent 20%,rgba(80,255,190,.26) 40%,rgba(120,120,255,.24) 62%,transparent 82%);' +
      'mask-image:linear-gradient(to bottom,transparent 10%,#000 44%,#000 88%,transparent 100%);' +
      'animation:rf-aur2 8.5s ease-in-out infinite;filter:blur(22px);will-change:transform'));
    particles = 'stars';
  } else if (variant === 'C') {
    css += '@keyframes rf-frost{0%{opacity:.55}50%{opacity:.9}100%{opacity:.55}}';
    host.appendChild(layer(
      'background:radial-gradient(38% 30% at 0% 0%,rgba(206,238,255,.5),transparent 68%),' +
      'radial-gradient(34% 28% at 100% 0%,rgba(190,228,255,.44),transparent 66%),' +
      'radial-gradient(40% 32% at 0% 100%,rgba(180,220,255,.4),transparent 70%),' +
      'radial-gradient(36% 30% at 100% 100%,rgba(206,238,255,.46),transparent 68%);' +
      'filter:blur(10px);animation:rf-frost 6s ease-in-out infinite'));
    particles = 'crystals';
  } else if (variant === 'D') {
    /* ГОРН: свечение расцветает за 1500 мс по ease-out-cubic, затем дышит.
       Было: opacity .7 сразу на первом кадре, то есть вход за 0 мс. */
    css += '@keyframes rf-bloom{0%{opacity:0;transform:scaleY(.88)}100%{opacity:1;transform:scaleY(1)}}' +
      '@keyframes rf-heat{0%{opacity:.72}50%{opacity:1}100%{opacity:.72}}' +
      '@keyframes rf-shimmer{0%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-1.4%,0)}100%{transform:translate3d(0,0,0)}}' +
      '@keyframes rf-show{0%{opacity:0}100%{opacity:1}}';
    host.appendChild(layer(
      'background:radial-gradient(90% 62% at 50% 118%,rgba(224,110,40,.62),transparent 68%),' +
      'radial-gradient(60% 40% at 20% 108%,rgba(190,60,25,.5),transparent 72%);' +
      'filter:blur(22px);transform-origin:50% 100%;opacity:0;' +
      'animation:rf-bloom 1500ms cubic-bezier(.33,1,.68,1) both,rf-heat 4.5s ease-in-out 1500ms infinite'));
    host.appendChild(layer(
      'background:radial-gradient(120% 50% at 50% -10%,rgba(30,12,6,.72),transparent 70%);opacity:0;' +
      'animation:rf-show 1400ms cubic-bezier(.33,1,.68,1) both,rf-shimmer 5s ease-in-out 1400ms infinite'));
    particles = 'sparks';
  } else {
    css += '@keyframes rf-pulse{0%{opacity:.42}50%{opacity:.92}100%{opacity:.42}}';
    host.appendChild(layer(
      'background:radial-gradient(52% 60% at 6% 50%,rgba(204,156,66,.24),transparent 72%),' +
      'radial-gradient(52% 60% at 94% 50%,rgba(204,156,66,.24),transparent 72%);' +
      'animation:rf-pulse 3.6s ease-in-out infinite'));
    particles = 'runes';
  }

  /* Под reduce ключевые кадры не подключаем вовсе, а слои приводим к финальному
     виду руками: без этого inline `opacity:0` (старт расцветания) оставил бы
     тему невидимой, так как анимации нет и довести до 1 её некому. */
  if (reduce) {
    for (const el of Array.from(host.querySelectorAll<HTMLElement>('div'))) {
      el.style.animation = 'none';
      el.style.opacity = '1';
      el.style.transform = 'none';
    }
  } else {
    host.__style = injectKeyframes(css);
  }

  if (particles) drawParticles(host, particles, reduce);
}

function drawParticles(host: RitualHost, kind: ParticleKind, reduce: boolean): void {
  const W = 1280;
  const H = window.innerHeight || 900;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = `position:absolute;inset:0;width:${W}px;height:${H}px`;
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const parts: Particle[] = [];
  if (kind === 'rain') {
    for (let i = 0; i < 340; i++) parts.push({ x: Math.random() * W, y: Math.random() * H, v: 9 + Math.random() * 11, l: 14 + Math.random() * 26, w: 0.7 + Math.random() * 0.9, o: 0.18 + Math.random() * 0.35, r: 0, p: 0, s: 0 });
  } else if (kind === 'stars') {
    for (let i = 0; i < 220; i++) parts.push({ x: Math.random() * W, y: Math.random() * H * 0.9, r: 0.5 + Math.random() * 1.5, p: Math.random() * 6.28, s: 0.6 + Math.random() * 1.8 });
  } else if (kind === 'crystals') {
    for (let i = 0; i < 46; i++) {
      const edge = Math.floor(Math.random() * 4);
      const x = edge === 0 ? Math.random() * W * 0.16 : edge === 1 ? W - Math.random() * W * 0.16 : Math.random() * W;
      const y = edge === 2 ? Math.random() * H * 0.18 : edge === 3 ? H - Math.random() * H * 0.18 : Math.random() * H;
      parts.push({ x, y, r: 6 + Math.random() * 16, a: Math.random() * 3.14, p: Math.random() * 6.28, s: 0.5 + Math.random() * 1.2 });
    }
  } else if (kind === 'sparks') {
    /* Каскад вместо залпа: 30% искр рождаются в первые 500 мс, 40% — до 1200 мс,
       остальные 30% — до 2000 мс. Всего по-прежнему 170 штук. */
    for (let i = 0; i < 170; i++) parts.push(newSpark(W, H, 0));
  } else {
    for (let i = 0; i < 14; i++) {
      const left = i % 2 === 0;
      parts.push({
        x: left ? 26 + Math.random() * 54 : W - 26 - Math.random() * 54,
        y: 60 + (i / 14) * (H - 120),
        r: 0, p: Math.random() * 6.28, s: 0.7 + Math.random() * 1.1,
        rune: RUNES[Math.floor(Math.random() * RUNES.length)], sc: 16 + Math.random() * 12, rot: (Math.random() - 0.5) * 0.5
      });
    }
  }

  const t0 = performance.now();
  let last = t0;

  const draw = (now: number): void => {
    const dt = Math.min(50, now - last);
    last = now;
    const el = (now - t0) / 1000;
    const elMs = now - t0;
    ctx.clearRect(0, 0, W, H);
    ctx.save();

    if (kind === 'rain') {
      ctx.strokeStyle = 'rgba(186,214,238,.85)';
      for (const p of parts) {
        p.y += p.v! * dt * 0.06;
        p.x += p.v! * dt * 0.012;
        if (p.y > H) { p.y = -20; p.x = Math.random() * W; }
        ctx.globalAlpha = p.o!;
        ctx.lineWidth = p.w!;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 2.2, p.y + p.l!);
        ctx.stroke();
      }
    } else if (kind === 'stars') {
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        ctx.globalAlpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(el * p.s + p.p));
        ctx.fillStyle = i % 7 === 0 ? '#BEE8FF' : '#EAF3FF';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
    } else if (kind === 'crystals') {
      ctx.strokeStyle = 'rgba(214,242,255,.95)';
      ctx.lineWidth = 1.2;
      for (const p of parts) {
        ctx.globalAlpha = 0.4 + 0.45 * (0.5 + 0.5 * Math.sin(el * p.s + p.p));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a! + el * 0.05);
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const aa = k * 2.094;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(aa) * p.r, Math.sin(aa) * p.r);
        }
        ctx.stroke();
        ctx.restore();
      }
    } else if (kind === 'sparks') {
      for (const p of parts) {
        const age = elMs - p.born!;
        if (age < 0) continue; // волна до этой искры ещё не дошла
        if (age > p.life!) {
          /* искра догорела — встаём в новую волну, поток не обрывается */
          Object.assign(p, newSpark(W, H, elMs));
          continue;
        }
        const pr = age / p.life!;
        const ease = easeOutQuad(pr); // быстрый подъём, замедление к концу полёта
        p.y = p.y0! - p.rise! * ease;
        p.x = p.x0! + p.d! * age * 0.02 * ease;
        const fadeIn = Math.min(1, age / 260);
        const fadeOut = 1 - smoothstep(Math.min(1, Math.max(0, (pr - 0.55) / 0.45)));
        ctx.globalAlpha = (0.34 + 0.56 * (0.5 + 0.5 * Math.sin(el * p.s + p.p))) * fadeIn * fadeOut;
        ctx.fillStyle = p.hot! > 0.55 ? 'rgba(255,214,150,.95)' : 'rgba(255,140,52,.9)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - 0.25 * pr), 0, 6.2832);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = '#E8C070';
      ctx.lineWidth = 2.1;
      ctx.lineCap = 'round';
      for (const p of parts) {
        ctx.globalAlpha = 0.3 + 0.62 * (0.5 + 0.5 * Math.sin(el * p.s + p.p));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot!);
        for (const seg of p.rune!) {
          ctx.beginPath();
          ctx.moveTo((seg[0][0] - 0.5) * p.sc!, (seg[0][1] - 0.5) * p.sc! * 1.7);
          ctx.lineTo((seg[1][0] - 0.5) * p.sc!, (seg[1][1] - 0.5) * p.sc! * 1.7);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.restore();

    /* вспышки молний — поверх дождя, четыре за первые три секунды */
    if (kind === 'rain') {
      let fl = 0;
      for (const mark of [0.55, 1.35, 2.15, 2.8]) {
        const d = el - mark;
        if (d >= 0 && d < 0.22) fl = Math.max(fl, (1 - d / 0.22) * 0.55);
      }
      if (fl > 0) {
        ctx.globalAlpha = fl;
        ctx.fillStyle = '#DCE8F5';
        ctx.fillRect(0, 0, W, H);
      }
    }
    if (!reduce) host.__raf = requestAnimationFrame(draw);
  };

  if (reduce) { draw(t0); host.__raf = 0; } else host.__raf = requestAnimationFrame(draw);
}

/** Новая искра: время рождения по каскаду, разброс высоты и скорости полёта. */
function newSpark(W: number, H: number, elMs: number): Particle {
  const u = Math.random();
  const wave = u < 0.3 ? Math.random() * 500 : u < 0.7 ? 500 + Math.random() * 700 : 1200 + Math.random() * 800;
  return {
    x: 0, r: 0.7 + Math.random() * 2.2, p: Math.random() * 6.28, s: 2 + Math.random() * 4, hot: Math.random(),
    x0: Math.random() * W,
    y0: H + 16 + Math.random() * 90,
    /* первый заход — по каскаду от старта темы, дальше волны идут подряд */
    born: elMs + (elMs === 0 ? wave : wave * 0.18),
    life: 1700 + Math.random() * 1500,
    rise: 200 + Math.random() * 460,
    d: (Math.random() - 0.5) * 1.4
  };
}

export const RITUAL_LABELS: Record<RitualVariant | 'off', string> = {
  off: 'Off',
  A: 'Гроза Тора',
  B: 'Северное сияние',
  C: 'Ледяной щит',
  D: 'Кузнечный горн',
  E: 'Руны Одина'
};
