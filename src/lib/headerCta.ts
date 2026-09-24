/**
 * Кнопка «Записаться» в шапке (§10.2, правка 2026-09-24).
 *
 * Поведение: в Hero кнопки нет; она появляется, когда в кадр входит первая
 * секция после Hero (`#manifest`), и снова прячется при возврате к Hero.
 * Магнита, звука и ритуала у кнопки больше нет — остался обычный hover-стиль
 * и скролл к форме по клику (ссылка ведёт на `#contact`, Lenis перехватывает
 * якорь сам).
 *
 * Порог считается по доле секции в кадре. Manifest выше экрана (1205 px при
 * окне 900 px), поэтому «50 % секции в кадре» физически недостижимо: максимум
 * равен высоте окна, делённой на высоту секции. Чтобы выбранный порог не
 * молчал, к правилу добавлено второе условие — секция занимает кадр целиком
 * (верх ушёл выше кромки, низ ещё ниже кромки). Тогда 50 % работает и на
 * высоких секциях.
 *
 * Состояние не сбрасывается при прокрутке ниже секции: кнопка появляется один
 * раз при входе Manifest и живёт до возврата в Hero — так и просил Кирилл.
 */

export const CTA_THRESHOLDS = [0.1, 0.3, 0.5] as const;
export const CTA_DURS = [200, 300, 500] as const;
export const CTA_EASES: Record<string, string> = {
	'ease-out-cubic': 'cubic-bezier(0.33, 1, 0.68, 1)',
	'ease-in-out': 'ease-in-out'
};
export const CTA_DEFAULT = { threshold: 0.3, dur: 300, ease: 'ease-out-cubic' };

export interface CtaOptions {
	threshold?: number;
	dur?: number;
	ease?: string;
}

/** Плотная сетка порогов: решение принимается по геометрии, сетка лишь будит. */
const OBSERVER_STEPS = Array.from({ length: 51 }, (_, i) => i / 50);

export function initHeaderCta(options: CtaOptions = {}): () => void {
	const threshold = options.threshold ?? CTA_DEFAULT.threshold;
	const dur = options.dur ?? CTA_DEFAULT.dur;
	const ease = CTA_EASES[options.ease ?? CTA_DEFAULT.ease] ?? options.ease ?? CTA_EASES['ease-out-cubic'];

	const slots = Array.from(document.querySelectorAll<HTMLElement>('[data-header-cta]'));
	const manifest = document.getElementById('manifest');
	if (!slots.length || !manifest) return () => undefined;

	/* Скрытое состояние включаем только при живом скрипте: без JS кнопка
	   остаётся видимой, иначе навигация к форме пропала бы совсем. */
	document.documentElement.setAttribute('data-cta-js', '');
	for (const slot of slots) {
		slot.style.setProperty('--cta-fade-dur', `${dur}ms`);
		slot.style.setProperty('--cta-fade-ease', ease);
	}

	let shown: boolean | null = null;

	const measure = () => {
		const rect = manifest.getBoundingClientRect();
		const vh = window.innerHeight;
		/* видимая часть секции и её потолок: секция может быть выше окна */
		const visible = Math.min(rect.height, Math.max(0, Math.min(vh, rect.bottom) - Math.max(0, rect.top)));
		const cap = Math.min(rect.height, vh);
		const fills = rect.top <= 0 && rect.bottom > 0;
		return { ratio: cap > 0 ? visible / cap : 0, fills, rect, vh };
	};

	const paint = () => {
		for (const slot of slots) slot.toggleAttribute('data-cta-visible', shown === true);
	};

	const evaluate = () => {
		const { ratio, fills, rect, vh } = measure();
		/* Латч: как только Manifest вошёл в кадр на порог, кнопка живёт до
		   возврата в Hero — прокрутка ниже секции состояние не меняет.
		   Иначе кнопка гасла бы, стоило секции уйти вверх за кромку. */
		const heroBack = rect.top >= vh;
		const entered = ratio >= threshold || fills;
		const next = heroBack ? false : entered ? true : shown === true;
		if (next !== shown) {
			shown = next;
			paint();
			window.dispatchEvent(new CustomEvent('cta:change', { detail: { visible: next, ratio, fills } }));
		} else {
			window.dispatchEvent(new CustomEvent('cta:measure', { detail: { visible: next, ratio, fills } }));
		}
	};

	const io = new IntersectionObserver(evaluate, { threshold: OBSERVER_STEPS });
	io.observe(manifest);
	window.addEventListener('resize', evaluate);
	evaluate();

	return () => {
		io.disconnect();
		window.removeEventListener('resize', evaluate);
		document.documentElement.removeAttribute('data-cta-js');
	};
}
