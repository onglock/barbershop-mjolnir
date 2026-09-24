import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
	Accordion,
	AccordionContent,
	AccordionHeader,
	AccordionItem,
	AccordionTrigger,
} from './ui/accordion';

const EASE_HOVER: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Секция «Вопросы» (F2 «Рунические строки», вариант A2).
 *
 * Radix даёт семантику и клавиатуру, Motion ведёт высоту панели и поворот руны,
 * цвет линии и руны — CSS-transition: Motion не интерполирует цвет, заданный
 * через var(--accent), а transition-colors в проекте уже стандарт (шапка, кнопки).
 *
 * Панель смонтирована постоянно (forceMount), поэтому ответ находится поиском
 * по странице. От скринридеров закрытая панель скрыта атрибутом aria-hidden —
 * он не влияет на поиск, но убирает текст из дерева доступности.
 *
 * Адрес в вопросе 04 — без точного адреса намеренно: сайт-пробник, точные данные
 * не нужны (решение Кирилла, 2026-09-19). Телефон в шапке остаётся заглушкой.
 */
const QUESTIONS = [
	{
		id: 'price',
		rune: 'ᚦ',
		num: '01',
		question: 'Сколько стоит стрижка и что входит в цену?',
		answer:
			'Мужская стрижка — 3 500 ₽, стрижка машинкой — 2 000 ₽. В цену входят консультация, мытьё, стрижка и укладка.',
	},
	{
		id: 'booking',
		rune: 'ᛗ',
		num: '02',
		question: 'Как записаться и нужно ли приходить заранее?',
		answer: 'Через форму на сайте или по телефону. Приходите за 5 минут до начала — начнём без спешки.',
	},
	{
		id: 'cancel',
		rune: 'ᚱ',
		num: '03',
		question: 'Можно ли перенести или отменить запись?',
		answer:
			'Предупредите за 3 часа по телефону — перенесём на удобное время. Отменять можно без объяснений.',
	},
	{
		id: 'place',
		rune: 'ᛁ',
		num: '04',
		question: 'Где вас найти и есть ли парковка?',
		answer: 'Никольская — рядом городская парковка, вечером места есть.',
	},
	{
		id: 'payment',
		rune: 'ᛋ',
		num: '05',
		question: 'Как можно оплатить?',
		answer: 'Наличными, картой и переводом. Чек выдаём на месте; для компаний выставляем счёт.',
	},
	{
		id: 'kids',
		rune: 'ᛏ',
		num: '06',
		question: 'Стрижёте ли вы детей?',
		answer: 'Да, с 6 лет и вместе со взрослым. Услуга «Отец и сын» — 5 000 ₽ на двоих.',
	},
	{
		id: 'name',
		rune: 'ᛒ',
		num: '07',
		question: 'Почему «Мьёльнир»?',
		answer: 'Мьёльнир — молот Тора. Он про вес и точность инструмента. Лишь рука мастера достойна его поднять.',
	},
];

export default function Faq() {
	const reduced = useReducedMotion() ?? false;
	const [open, setOpen] = useState<string | null>(null);

	const heightTransition = reduced ? { duration: 0 } : { duration: 0.28, ease: EASE_HOVER };
	const runeTransition = reduced
		? { duration: 0 }
		: { duration: 0.2, ease: EASE_HOVER, delay: 0.02 };

	return (
		<section id="faq" className="scroll-mt-24 border-b border-border px-6 py-8 lg:px-8 lg:py-10">
			<div className="mx-auto max-w-[1400px]">
				<p className="font-label text-label uppercase text-text-muted">Вопросы</p>

				<h2 className="mt-6 max-w-[14ch] text-h2 uppercase text-text">Что спрашивают</h2>

				<Accordion
					type="single"
					collapsible
					value={open ?? ''}
					onValueChange={(value) => setOpen(value || null)}
					className="mt-16 border-b border-border"
				>
					{QUESTIONS.map((item) => {
						const isOpen = open === item.id;

						return (
							<AccordionItem key={item.id} value={item.id}>
								{/* Линия-разделитель: отдельный элемент 1px, а не border —
								    так у неё есть и цвет, и собственная жизнь при раскрытии */}
								<span
									aria-hidden="true"
									className={cn(
										'pointer-events-none absolute inset-x-0 top-0 h-px transition-colors duration-200 ease-hover',
										isOpen ? 'bg-accent' : 'bg-border'
									)}
								/>

								<AccordionHeader>
									<AccordionTrigger>
										<motion.span
											aria-hidden="true"
											/* При reduced-motion руна не поворачивается вовсе —
											    нулевая длительность всё равно дала бы поворот рывком */
											animate={{ rotate: reduced ? 0 : isOpen ? 90 : 0 }}
											transition={runeTransition}
											className={cn(
												'w-5 shrink-0 text-center text-base leading-none transition-colors duration-200 ease-hover',
												isOpen ? 'text-accent' : 'text-text-muted'
											)}
										>
											{item.rune}
										</motion.span>

										<span
											aria-hidden="true"
											className={cn(
												'shrink-0 text-label tabular-nums transition-colors duration-200 ease-hover',
												isOpen ? 'text-accent' : 'text-text-muted'
											)}
										>
											{item.num}
										</span>

										<span className="flex-1 text-[18px] font-medium tracking-[-0.02em] text-text">
											{item.question}
										</span>
									</AccordionTrigger>
								</AccordionHeader>

								{/* Закрытая панель скрыта от скринридеров, но остаётся в DOM:
								    ответ доступен поиску по странице */}
								<AccordionContent aria-hidden={!isOpen}>
									<motion.div
										initial={false}
										animate={{ height: isOpen ? 'auto' : 0 }}
										transition={heightTransition}
										className="overflow-hidden"
									>
										<p className="max-w-[62ch] pb-6 text-body text-text-muted lg:pl-9">{item.answer}</p>
									</motion.div>
								</AccordionContent>
							</AccordionItem>
						);
					})}
				</Accordion>
			</div>
		</section>
	);
}
