import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const EASE_SCENE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_HOVER: [number, number, number, number] = [0.22, 1, 0.36, 1];

const TITLE = 'Сталь. Время. Ремесло.';
const SUBTITLE = 'Стрижка — не пятнадцать минут, а внимание к форме головы, росту волос и вашему утру.';


/**
 * Сцена входа hero: лейбл → сплит-текст заголовка → подзаголовок → CTA.
 * При prefers-reduced-motion каскад пропускается: каждому
 * элементу явно задаётся конечное состояние с нулевой длительностью.
 *
 * Почему не «initial/animate = undefined»: сервер не знает про медиазапрос,
 * поэтому в SSR-разметке уже лежат стартовые стили (opacity 0, blur, сдвиг).
 * Если на клиенте просто не передать анимацию, элемент остаётся в этом
 * стартовом состоянии — текст пропадает совсем.
 */
export default function HeroIntro() {
	const reduced = useReducedMotion() ?? false;
	const words = TITLE.split(' ');

	/* Пиксельные «Авто-равные» — только там, где на <html> стоит
	   data-hero-gaps="pixel" (сейчас — /hero-spacing-preview). Модуль берём
	   ДИНАМИЧЕСКИМ импортом: на главной он не нужен и в её загрузку попадать
	   не должен. На главной режим прежний — автораспределение по боксам. */
	useEffect(() => {
		if (document.documentElement.dataset.heroGaps !== 'pixel') return;
		let stop: (() => void) | undefined;
		let cancelled = false;
		import('../lib/heroGaps')
			.then((m) => {
				if (!cancelled) stop = m.watchHeroGaps();
			})
			.catch(() => {});
		return () => {
			cancelled = true;
			stop?.();
		};
	}, []);

	const fade = (delay: number) => ({
		initial: { opacity: reduced ? 1 : 0 },
		animate: { opacity: 1 },
		transition: reduced ? { duration: 0 } : { duration: 0.8, delay, ease: EASE_HOVER },
	});

	return (
		<div className="pointer-events-none absolute inset-0 z-[3]">
			<div className="hero-intro mx-auto flex h-full w-full max-w-[1400px] flex-col justify-center px-6 pt-24 lg:px-8">
				<div className="pointer-events-auto max-w-[680px]">
					<motion.p className="text-label uppercase text-text-muted" {...fade(0.1)}>
						Барбершоп · Москва · с 2014
					</motion.p>

					<h1 className="mt-8 text-display uppercase text-text lg:mt-5 lg:max-w-[11ch]">
						{words.map((word, index) => (
							<span key={word} className="inline-block overflow-hidden align-bottom">
								<motion.span
									className="inline-block"
									initial={
										reduced
											? { y: 0, opacity: 1, filter: 'blur(0px)' }
											: { y: '100%', opacity: 0, filter: 'blur(8px)' }
									}
									animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
									transition={
										reduced
											? { duration: 0 }
											: { duration: 0.9, delay: 0.3 + index * 0.06, ease: EASE_SCENE }
									}
								>
									{word}
									{index < words.length - 1 ? '\u00A0' : ''}
								</motion.span>
							</span>
						))}
					</h1>

				</div>

				{/* Подзаголовок — прямой ребёнок .hero-intro: только так его
				    margin-top: auto участвует в раздаче зазоров. */}
					<motion.p className="hero-sub mt-8 max-w-[42ch] text-body text-text-muted lg:mt-5 lg:max-w-[44ch]" {...fade(0.9)}>
						{SUBTITLE}
					</motion.p>

				{/* Слот бывшей CTA — прямой ребёнок .hero-intro, чтобы центрироваться
				   по всей ширине Hero, а не по колонке текста. */}
				<motion.div className="hero-cta mt-12 lg:mt-8" {...fade(1.1)}>
						{/* Оба элемента — в одной точке: слот бывшей CTA. До клика
						   виден призыв «Нажми — узнаешь…», после прилёта он гаснет
						   и на его месте проявляется рамка «Ты достоин».
						   Огонь по рамке — этап 2, здесь только механика. */}
						<p className="hero-call" data-role="call">Нажми — узнаешь, достоин ли ты стрижки рукой мастера</p>
						<button type="button" className="hero-frame" id="hero-frame">
							<span className="hero-frame__label hero-frame__label--desktop">Ты достоин</span>
							<span className="hero-frame__label hero-frame__label--hover">Записаться</span>
							<span className="hero-frame__label hero-frame__label--mobile">Ты достоин — жми чтобы записаться</span>
							{/* Огонь по периметру (§10.3.1, этап 2): две линии от середины
							   верхней границы — влево и вправо, встречаются в середине
							   нижней. Геометрию путей и viewBox ставит скрипт из Hero.astro
							   по фактическому размеру рамки; pathLength="1" нормализует
							   длину, поэтому анимация не зависит от размера. */}
							<svg className="hero-frame__fire" aria-hidden="true" focusable="false">
								<path pathLength="1" data-side="left" />
								<path pathLength="1" data-side="right" />
							</svg>
						</button>
				</motion.div>

				{/* Водяной знак C2 — элемент потока: margin-top: auto раздаёт
				    остаток высоты поровну между тремя зазорами. */}
				<div className="hero-decor decor-2" aria-hidden="true"><span>МЬЁЛЬНИР</span></div>
		</div>
	</div>
);
}
