/**
 * React-хук магнитной кнопки (§10.1).
 *
 * Отдаёт ref, который вешается на элемент кнопки. Вся механика — в ядре
 * (lib/magnetic.ts), хук только следит за prefers-reduced-motion: при reduce
 * обработчики не ставятся вообще, кнопка остаётся статичной.
 *
 * Важно про конфликт с hover: классы кнопки живут на CSS-свойстве `translate`
 * (hover:-translate-y-0.5), а магнит пишет в `transform` — это разные свойства,
 * они складываются, а не перетирают друг друга.
 */
import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { attachMagneticBehavior, type MagneticOptions } from './magnetic';

export function useMagnetic<T extends HTMLElement>(options: MagneticOptions = {}) {
	const ref = useRef<T>(null);
	const reduced = useReducedMotion() ?? false;
	const { sound = false } = options;

	useEffect(() => {
		const el = ref.current;
		if (!el || reduced) return;
		return attachMagneticBehavior(el, { sound });
	}, [reduced, sound]);

	return ref;
}
