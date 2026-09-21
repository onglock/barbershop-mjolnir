/**
 * Магнит для разметки из .astro: находит `[data-magnetic]` и включает ядро.
 *
 * Разметка в .astro не может пользоваться React-хуком, а плодить по острову
 * на каждую ссылку футера — дороже, чем один проход по атрибутам. Здесь тот же
 * код, что и в useMagnetic: логика живёт в lib/magnetic.ts, дублирования нет.
 *
 * `data-magnetic`        — магнит без звука (навигация, футер);
 * `data-magnetic="catch"` — магнит со звуком подхвата (только CTA).
 */
import { armMagneticSound } from './magneticSound';
import { attachMagneticBehavior } from './magnetic';

armMagneticSound();

let attached = new WeakSet<HTMLElement>();

function scan(): void {
	const nodes = document.querySelectorAll<HTMLElement>('[data-magnetic]');
	nodes.forEach((el) => {
		if (attached.has(el)) return;
		attached.add(el);
		attachMagneticBehavior(el, { sound: el.dataset.magnetic === 'catch' });
	});
}

scan();
document.addEventListener('astro:page-load', scan);
