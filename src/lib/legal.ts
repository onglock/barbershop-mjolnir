/**
 * Юридические документы: реквизиты и общие данные страниц.
 *
 * Единственный источник правды для /oferta, /privacy, /requisites и ссылок в
 * футере — чтобы реквизиты не расходились по трём копиям. Данные ИП заданы
 * Кириллом (2026-10-03) и должны совпадать с банковскими документами.
 *
 * Тексты документов — типовые шаблоны, юридическая проверка рекомендована.
 */

export const legal = {
	/** Дата последнего обновления документов — формальная часть. */
	updated: '3 октября 2026 года',
	city: 'Москва',
	brand: 'Мьёльнир',
	/** Адрес в том виде, в каком он уже есть в проекте (точный адрес не указан). */
	address: 'Москва, Никольская',
	/** Адрес-заглушка из astro.config.mjs (site). */
	siteUrl: 'https://barbershop-mjolnir.vercel.app',
	siteLabel: 'barbershop-mjolnir.vercel.app',

	executor: {
		/** Как называть в текстах документов. */
		short: 'ИП Минасов Кирилл Георгиевич',
		/** Полное ФИО — в реквизитах, как в банковских документах. */
		fullName: 'МИНАСОВ КИРИЛЛ ГЕОРГИЕВИЧ',
		status: 'Индивидуальный предприниматель',
		inn: '262611069290',
		account: '40802810716240002387',
		currency: 'RUR',
		bank: 'АО «АЛЬФА-БАНК»',
		bik: '044525593',
		corr: '30101810200000000593',
		phone: '+7 (933) 182-56-34',
		phoneHref: 'tel:+79331825634',
		email: 'ttat4296@gmail.com',
	},
} as const;

/** Строка реквизитов для страницы /requisites — порядок как в банковской справке. */
export const requisites: { label: string; value: string; href?: string }[] = [
	{ label: 'Наименование', value: 'ИП Минасов Кирилл Георгиевич' },
	{ label: 'ФИО', value: legal.executor.fullName },
	{ label: 'ИНН', value: legal.executor.inn },
	{ label: 'Расчётный счёт', value: legal.executor.account },
	{ label: 'Валюта', value: legal.executor.currency },
	{ label: 'Банк', value: legal.executor.bank },
	{ label: 'БИК', value: legal.executor.bik },
	{ label: 'Корреспондентский счёт', value: legal.executor.corr },
	{ label: 'Телефон', value: legal.executor.phone, href: legal.executor.phoneHref },
	{ label: 'Email', value: legal.executor.email, href: `mailto:${legal.executor.email}` },
	{ label: 'Адрес', value: legal.address },
];

/** Ссылки юридического блока — футер и превью берут их отсюда. */
export const legalLinks = [
	{ href: '/oferta', label: 'Публичная оферта' },
	{ href: '/privacy', label: 'Политика конфиденциальности' },
	{ href: '/requisites', label: 'Реквизиты' },
];

/** Формулировка согласия — одна и та же в форме и в политике (§9). */
export const consentText = 'Я согласен на обработку персональных данных';
