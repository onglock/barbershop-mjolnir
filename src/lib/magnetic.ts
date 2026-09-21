/**
 * Ядро магнитной кнопки (§10.1). Фреймворк-агностик: работает и из React-хука
 * (useMagnetic), и из обычного скрипта по атрибуту `data-magnetic` в .astro.
 *
 * Механика:
 *   • курсор в радиусе RADIUS от центра — кнопка лениво тянется к курсору
 *     (lerp), смещение ограничено MAX_SHIFT;
 *   • подошла к курсору ближе CATCH_PX — один раз «подхват»: короткое
 *     сотрясение 2–3 кадра и, если разрешено, звук;
 *   • курсор ушёл из радиуса — возврат на место более быстрым lerp.
 *
 * Отключается полностью: prefers-reduced-motion, отсутствие мыши
 * (`hover: none`), узкие экраны. Тело кнопки не двигаем на тач-устройствах.
 */
import { playMagneticCatch } from './magneticSound';

export type MagneticOptions = {
	/** звук подхвата — только для CTA (§10.1) */
	sound?: boolean;
};

const RADIUS = 90; // радиус притяжения, px
const MAX_SHIFT = 24; // предел смещения кнопки, px
const LERP_IN = 0.09; // ленивое приближение
const LERP_OUT = 0.15; // возврат на место
const CATCH_PX = 2.5; // порог «подхвата», px
const SHAKE_MS = 42; // длительность сотрясения (2–3 кадра при 60 Гц)
const SHAKE_AMP = 3; // амплитуда сотрясения, px

type State = {
	x: number;
	y: number;
	tx: number;
	ty: number;
	shakeStart: number;
	caught: boolean;
};

/** Магнит осмыслен только там, где есть настоящий курсор и нет просьбы о покое. */
export function magnetAllowed(): boolean {
	if (typeof window === 'undefined') return false;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
	return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/**
 * Единая точка входа для кнопок.
 *
 *   • курсор есть и покой не запрошен — магнит (и звук подхвата, если разрешён);
 *   • устройство без курсора — магнита нет, но звук по тапу остаётся:
 *     на мобильном «клац» должен звучать, только короче и без движения;
 *   • prefers-reduced-motion — не включаем ничего, в том числе звук (§10.1).
 */
export function attachMagneticBehavior(el: HTMLElement, options: MagneticOptions = {}): () => void {
	if (typeof window === 'undefined') return () => {};
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
	if (magnetAllowed()) return attachMagnet(el, options);
	if (!options.sound) return () => {};

	// Тач-устройство: звук по тапу + короткая вибрация, если браузер умеет
	const onTap = () => {
		playMagneticCatch();
		if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(10);
	};
	el.addEventListener('pointerdown', onTap);
	return () => el.removeEventListener('pointerdown', onTap);
}

export function attachMagnet(el: HTMLElement, options: MagneticOptions = {}): () => void {
	if (!magnetAllowed()) return () => {};

	const state: State = { x: 0, y: 0, tx: 0, ty: 0, shakeStart: 0, caught: false };
	let frame = 0;
	let inside = false;

	const tick = () => {
		const now = performance.now();

		// Сотрясение: 2–3 кадра. Косинус даёт максимум на первом же кадре —
		// при 60 Гц синус давал всего 0,5–0,8 px, и толчок не читался.
		let shakeX = 0;
		let shakeY = 0;
		if (state.shakeStart) {
			const elapsed = now - state.shakeStart;
			if (elapsed < SHAKE_MS) {
				const decay = 1 - elapsed / SHAKE_MS;
				const phase = Math.cos((elapsed / SHAKE_MS) * Math.PI * 2);
				shakeX = phase * SHAKE_AMP * decay;
				shakeY = -phase * SHAKE_AMP * 0.45 * decay;
			} else {
				state.shakeStart = 0;
			}
		}

		const lerp = inside ? LERP_IN : LERP_OUT;
		state.x += (state.tx - state.x) * lerp;
		state.y += (state.ty - state.y) * lerp;

		// Подхват: кнопка дошла до курсора. Только один раз за подход.
		if (inside && !state.caught) {
			const dx = state.tx - state.x;
			const dy = state.ty - state.y;
			if (Math.hypot(dx, dy) <= CATCH_PX) {
				state.caught = true;
				state.shakeStart = now;
				if (options.sound) playMagneticCatch();
			}
		}

		el.style.transform = `translate3d(${(state.x + shakeX).toFixed(2)}px, ${(state.y + shakeY).toFixed(2)}px, 0)`;

		const settled =
			!inside && Math.abs(state.x) < 0.05 && Math.abs(state.y) < 0.05 && !state.shakeStart;
		if (settled) {
			el.style.transform = '';
			el.style.willChange = '';
			frame = 0;
			return;
		}
		frame = requestAnimationFrame(tick);
	};

	const start = () => {
		if (!frame) {
			el.style.willChange = 'transform';
			frame = requestAnimationFrame(tick);
		}
	};

	const onMove = (event: PointerEvent) => {
		const rect = el.getBoundingClientRect();
		// getBoundingClientRect уже включает текущее смещение — считаем от базы
		const centerX = rect.left + rect.width / 2 - state.x;
		const centerY = rect.top + rect.height / 2 - state.y;
		const dx = event.clientX - centerX;
		const dy = event.clientY - centerY;
		const distance = Math.hypot(dx, dy);

		if (distance > RADIUS) {
			if (inside || state.x !== 0 || state.y !== 0) {
				inside = false;
				state.tx = 0;
				state.ty = 0;
				state.caught = false;
				start();
			}
			return;
		}

		const limit = MAX_SHIFT / Math.max(distance, 0.001);
		const scale = distance > MAX_SHIFT ? limit : 1;
		state.tx = dx * scale;
		state.ty = dy * scale;
		if (!inside) {
			inside = true;
			state.caught = false;
		}
		start();
	};

	const onLeaveWindow = () => {
		inside = false;
		state.tx = 0;
		state.ty = 0;
		state.caught = false;
		start();
	};

	window.addEventListener('pointermove', onMove, { passive: true });
	window.addEventListener('blur', onLeaveWindow);
	document.addEventListener('pointerleave', onLeaveWindow);

	return () => {
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('blur', onLeaveWindow);
		document.removeEventListener('pointerleave', onLeaveWindow);
		if (frame) cancelAnimationFrame(frame);
		el.style.transform = '';
		el.style.willChange = '';
	};
}
