import { useId, useState } from 'react';
import { useMagnetic } from '@/lib/useMagnetic';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';
import { services } from './Services';

/**
 * Секция «Запись» (решение C3 «Поле-подчёркивание» + сегментная полоса
 * заполнения, визуал из C2).
 *
 * Поля без рамок и заливки: только подчёркивание. Фокус — подчёркивание
 * становится акцентным, лейбл подхватывает акцент через group-focus-within.
 * Глобальный outline на полях отключён осознанно: у поля нет рамки, и
 * двухпиксельная обводка вокруг подчёркивания спорит с линией. Индикатор
 * фокуса — сама линия, контраст 9,1:1 к фону.
 *
 * Полоса — 5 сегментов, по одному на поле: заполняется, когда поле валидно
 * (обязательные — по проверке, опциональные — когда значение есть).
 * Геометрию ведёт Motion, цвет — CSS: Motion не интерполирует var(--accent).
 *
 * Бэкенда нет: отправка — заглушка, реального запроса не уходит.
 * TODO: подключить приёмник (Formspree / mailto / свой эндпоинт) — решение за Кириллом.
 */

const EASE_HOVER: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Мастера те же, что в Masters.astro. Импортировать из .astro нельзя — держим копию. */
const MASTERS = ['Артём Соколов', 'Данил Ковалёв', 'Максим Лебедев'];

type FieldName = 'name' | 'phone' | 'service' | 'master' | 'comment';

type Values = Record<FieldName, string>;

const EMPTY: Values = { name: '', phone: '', service: '', master: '', comment: '' };

const FIELDS: {
	name: FieldName;
	label: string;
	required: boolean;
	kind: 'input' | 'select' | 'textarea';
	type?: string;
	/** текст пустой опции у select */
	placeholder?: string;
}[] = [
	{ name: 'name', label: 'Имя', required: true, kind: 'input', type: 'text' },
	{ name: 'phone', label: 'Телефон', required: true, kind: 'input', type: 'tel' },
	{ name: 'service', label: 'Услуга', required: false, kind: 'select', placeholder: 'Не выбрана' },
	{ name: 'master', label: 'Мастер', required: false, kind: 'select', placeholder: 'Любой' },
	{ name: 'comment', label: 'Комментарий', required: false, kind: 'textarea' },
];

/** Ошибка поля или null. Пустое опциональное поле — не ошибка. */
function validate(name: FieldName, value: string): string | null {
	if (name === 'name' && value.trim().length < 2) return 'Как к вам обращаться?';
	if (name === 'phone' && value.replace(/\D/g, '').length < 10) return 'Телефон для подтверждения';
	return null;
}

/** Приводит телефон к одному виду при уходе из поля. Ввод не блокирует. */
function formatPhone(raw: string): string {
	const d = raw.replace(/\D/g, '');
	if (d.length === 11 && (d[0] === '7' || d[0] === '8')) {
		const s = d.slice(1);
		return `+7 (${s.slice(0, 3)}) ${s.slice(3, 6)}-${s.slice(6, 8)}-${s.slice(8, 10)}`;
	}
	if (d.length === 10) return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
	return raw.trim();
}

export default function ContactForm() {
	const reduced = useReducedMotion() ?? false;
	const uid = useId();
	const submitRef = useMagnetic<HTMLButtonElement>({ sound: true });
	const [values, setValues] = useState<Values>(EMPTY);
	const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
	const [sent, setSent] = useState(false);

	const errors = Object.fromEntries(FIELDS.map((f) => [f.name, validate(f.name, values[f.name])])) as Record<
		FieldName,
		string | null
	>;

	// Поле считается заполненным: обязательное — прошло проверку, опциональное — просто непустое
	const isFilled = (name: FieldName) =>
		FIELDS.find((f) => f.name === name)!.required ? !errors[name] && values[name].trim() !== '' : values[name].trim() !== '';

	const filledCount = FIELDS.filter((f) => isFilled(f.name)).length;

	const fillTransition = reduced ? { duration: 0 } : { duration: 0.32, ease: EASE_HOVER };
	const errorTransition = reduced ? { duration: 0 } : { duration: 0.2, ease: EASE_HOVER };

	const set = (name: FieldName, value: string) => setValues((prev) => ({ ...prev, [name]: value }));

	const blur = (name: FieldName) => {
		setTouched((prev) => ({ ...prev, [name]: true }));
		if (name === 'phone') setValues((prev) => ({ ...prev, phone: formatPhone(prev.phone) }));
	};

	const submit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setTouched(Object.fromEntries(FIELDS.map((f) => [f.name, true])));
		const firstBad = FIELDS.find((f) => f.required && validate(f.name, values[f.name]));
		if (firstBad) {
			document.getElementById(`${uid}-${firstBad.name}`)?.focus();
			return;
		}
		// TODO: реальной отправки нет — заглушка до решения по приёмнику
		setSent(true);
	};

	return (
		<section id="contact" className="scroll-mt-16 border-b border-border px-6 pb-24 pt-4 lg:scroll-mt-[72px] lg:px-8 lg:pb-32 lg:pt-4">
			<div className="mx-auto max-w-[1400px]">
				{/* Вариант B — с мифологическим акцентом (принят Кириллом) */}
				<p className="font-label text-label uppercase text-text-muted">Ритуал</p>
				<h2 className="mt-6 max-w-[16ch] text-display uppercase text-text">Займите кресло</h2>
				<p className="mt-6 max-w-[42ch] text-body text-text-muted">
					Назовите имя и время — остальное сделает мастер.
				</p>

				{sent ? (
					<motion.div
						role="status"
						initial={reduced ? false : { opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={reduced ? { duration: 0 } : { duration: 0.4, ease: EASE_HOVER }}
						className="mt-14 max-w-[820px] border-t border-accent pt-8"
					>
						<p className="text-body text-text">Заявка принята, свяжемся в течение часа.</p>
						<p className="mt-3 font-label text-label uppercase text-text-muted">
							Отправка пока не подключена — это заглушка
						</p>
					</motion.div>
				) : (
					<form noValidate onSubmit={submit} className="mt-14 grid max-w-[820px] gap-x-8 gap-y-8 sm:grid-cols-2">
						{FIELDS.map((f) => {
							const id = `${uid}-${f.name}`;
							const errId = `${id}-error`;
							const error = errors[f.name];
							const showError = Boolean(touched[f.name]) && Boolean(error);
							const value = values[f.name];

							const control = cn(
								'w-full appearance-none border-b bg-transparent pb-3 pt-4 text-body text-text outline-none transition-colors duration-200 ease-hover focus:border-accent focus-visible:outline-none',
								showError ? 'border-error' : 'border-border'
							);

							return (
								<div key={f.name} className={cn('group', f.kind === 'textarea' && 'sm:col-span-2')}>
									<label
										htmlFor={id}
										className="flex items-center gap-1.5 font-label text-label uppercase text-text-muted transition-colors duration-200 ease-hover group-focus-within:text-accent"
									>
										{f.label}
										{f.required && (
											<span aria-hidden="true" className="text-accent">
												*
											</span>
										)}
									</label>

									<div className="relative">
										{f.kind === 'select' ? (
											<>
												<select
													id={id}
													name={f.name}
													value={value}
													onChange={(e) => set(f.name, e.target.value)}
													onBlur={() => blur(f.name)}
													aria-invalid={showError || undefined}
													aria-describedby={showError ? errId : undefined}
													className={cn(control, 'pr-6', value === '' && 'text-text-muted')}
												>
													<option value="">{f.placeholder}</option>
													{f.name === 'service'
														? services.map((s) => (
																<option key={s.name} value={s.name}>
																	{s.name} — {s.price}
																</option>
															))
														: MASTERS.map((m) => (
																<option key={m} value={m}>
																	{m}
																</option>
															))}
												</select>
												<svg
													aria-hidden="true"
													viewBox="0 0 12 8"
													className="pointer-events-none absolute bottom-4 right-0 h-2 w-3 text-text-muted"
												>
													<path d="M1 1.5 6 6.5l5-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
												</svg>
											</>
										) : f.kind === 'textarea' ? (
											<textarea
												id={id}
												name={f.name}
												value={value}
												rows={3}
												onChange={(e) => set(f.name, e.target.value)}
												onBlur={() => blur(f.name)}
												aria-invalid={showError || undefined}
												aria-describedby={showError ? errId : undefined}
												className={cn(control, 'resize-none')}
											/>
										) : (
											<input
												id={id}
												name={f.name}
												type={f.type}
												value={value}
												required={f.required}
												autoComplete={f.name === 'name' ? 'name' : 'tel'}
												onChange={(e) => set(f.name, e.target.value)}
												onBlur={() => blur(f.name)}
												aria-invalid={showError || undefined}
												aria-describedby={showError ? errId : undefined}
												className={control}
											/>
										)}
									</div>

									{showError && (
										<motion.p
											id={errId}
											initial={reduced ? false : { opacity: 0 }}
											animate={{ opacity: 1 }}
											transition={errorTransition}
											className="mt-2 text-label text-error"
										>
											{error}
										</motion.p>
									)}
								</div>
							);
						})}

						<div className="sm:col-span-2">
							<div className="flex items-center gap-4">
								<div aria-hidden="true" className="flex flex-1 gap-1">
									{FIELDS.map((f) => (
										<span key={f.name} className="relative h-0.5 flex-1 bg-border">
											<motion.span
												initial={false}
												animate={{ scaleX: isFilled(f.name) ? 1 : 0 }}
												transition={fillTransition}
												className="absolute inset-0 origin-left bg-accent"
											/>
										</span>
									))}
								</div>
								<span aria-hidden="true" className="text-label tabular-nums text-text-muted">
									{filledCount}/5
								</span>
							</div>
							<p className="sr-only">
								Заполнено полей: {filledCount} из 5
							</p>

							<div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
								<button ref={submitRef} type="submit" className={cn(buttonVariants({ variant: 'accent', size: 'lg' }))}>
									Записаться на стрижку
								</button>
								<p className="font-label text-label uppercase text-text-muted">* — обязательные поля</p>
							</div>
						</div>
					</form>
				)}
			</div>
		</section>
	);
}
