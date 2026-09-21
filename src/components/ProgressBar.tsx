import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';

/**
 * P1 «Волосяная нить 1px» — полоса прогресса чтения.
 *
 * Живёт в Layout, а не в index: страница может быть не одна.
 * client:load, потому что прогресс нужно считать с первого кадра, а не
 * после гидрации по видимости.
 *
 * Геометрия: scaleX от 0 до 1, origin-left. Под нитью лежит трек из
 * border — без него на старте верх страницы выглядит пустым.
 *
 * prefers-reduced-motion: пружину убираем и ведём scaleX напрямую от
 * scrollYProgress. Это не «мгновенный прыжок» — значение всё равно
 * меняется вместе со скроллом, просто без инерции.
 *
 * hover не касается: полоса не интерактивна (pointer-events-none).
 */
const EASE = { stiffness: 140, damping: 26, restDelta: 0.001 };

export default function ProgressBar() {
	const reduced = useReducedMotion() ?? false;
	const { scrollYProgress } = useScroll();
	const smooth = useSpring(scrollYProgress, EASE);

	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-px select-none"
		>
			{/* Трек: видно, что полоса есть, даже когда прогресс равен нулю */}
			<div className="absolute inset-0 bg-border" />
			<motion.div
				className="absolute inset-0 origin-left bg-accent"
				style={{ scaleX: reduced ? scrollYProgress : smooth }}
			/>
		</div>
	);
}
