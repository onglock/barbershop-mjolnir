import { motion, useReducedMotion } from 'framer-motion';
import { buttonVariants } from './ui/button';
import { useMagnetic } from '@/lib/useMagnetic';

const EASE_SCENE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_HOVER: [number, number, number, number] = [0.22, 1, 0.36, 1];

const TITLE = 'Сталь. Время. Ремесло.';
const SUBTITLE = 'Стрижка — не пятнадцать минут, а внимание к форме головы, росту волос и вашему утру.';

/**
 * Магнитная CTA (§10.1). Механика — в lib/magnetic.ts: ленивое притяжение,
 * подхват с сотрясением 2–3 кадра и синтезированный «клац». Хук сам выключает
 * магнит при prefers-reduced-motion и на устройствах без курсора, поэтому
 * кнопка остаётся обычной ссылкой. Вход в сцену анимирует внешняя обёртка —
 * transform магнита и transform Framer Motion не пересекаются.
 */
function MagneticCta() {
	const ref = useMagnetic<HTMLAnchorElement>({ sound: true });
	return (
		<a ref={ref} href="#contact" className={buttonVariants({ variant: 'accent', size: 'lg' })}>
			Записаться
		</a>
	);
}

/**
 * Сцена входа hero: лейбл → сплит-текст заголовка → подзаголовок → CTA →
 * индикатор скролла. При prefers-reduced-motion каскад пропускается: каждому
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

					<h1 className="mt-8 text-display uppercase text-text lg:max-w-[11ch]">
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

					<motion.p className="mt-8 max-w-[42ch] text-body text-text-muted" {...fade(0.9)}>
						{SUBTITLE}
					</motion.p>

					<motion.div className="mt-12" {...fade(1.1)}>
						<MagneticCta />
					</motion.div>
				</div>
		</div>
	</div>
);
}
