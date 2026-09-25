/* ── Контент раздела «Манифест» ───────────────────────────────────────
   Единственный источник текстов и кадров для боевого `Manifest.astro` и для
   превью (`/manifest-concepts-preview`, `/manifest-chronicle-preview`).
   Тексты абзацев — как были, без правок. Заголовки глав утверждены Кириллом
   2026-09-25. Смысл раздела: «Са́га о Мьёльнире» — история ремесла.
   ──────────────────────────────────────────────────────────────────── */
import interiorPhoto from '../assets/manifest-interior.jpg';
import chapter01 from '../assets/manifest/chapter-01.jpg';
import chapter02 from '../assets/manifest/chapter-02.jpg';
import chapter03 from '../assets/manifest/chapter-03.jpg';
import chapter04 from '../assets/manifest/chapter-04.jpg';

/* Кадр интерьера. Обложка хроники убрана решением Кирилла 2026-09-25, но файл
   живёт дальше: его показывают прототипы концепций и версия «До» на превью. */
export const manifestPhoto = interiorPhoto;

export const manifestLabel = 'Манифест';
export const manifestTitle = 'Ремесло, а не скидки';
export const manifestGhost = 'Мьёльнир';

export type ManifestParagraphId = 'founding' | 'craft' | 'tool' | 'honesty';

export type ManifestParagraph = {
	/* Стабильный ключ абзаца — по нему концепции группируют текст. */
	id: ManifestParagraphId;
	text: string;
};

export const manifestParagraphs: ManifestParagraph[] = [
	{
		id: 'founding',
		text: 'Мы открылись в 2014 году на Никольской — в подвале с кирпичными стенами и одним креслом. Правило с тех пор не менялось: один мастер, один клиент, одно кресло. Никакой записи каждые двадцать минут.',
	},
	{
		id: 'craft',
		text: 'Стрижка — это не услуга за пятнадцать минут. Мы разбираем форму головы, направление роста волос, то, чем вы укладываетесь дома. На это нужно время, и мы его тратим: за спиной мастера не стоит следующий.',
	},
	{
		id: 'tool',
		text: 'Работаем только инструментом, которым пользуемся сами: опасные бритвы, японские ножницы, воск вместо лака. После восьми вечера новых клиентов не берём — у мастера должна быть свежая рука.',
	},
	{
		id: 'honesty',
		text: 'Если пришли с фотографией из интернета — разберём, сядет ли форма на вашу голову, и честно скажем, если нет.',
	},
];

export const paragraphById = (id: ManifestParagraphId) =>
	manifestParagraphs.find((p) => p.id === id) as ManifestParagraph;

export type ManifestStat = { value: string; label: string };

export const manifestStats: ManifestStat[] = [
	{ value: '2014', label: 'год основания' },
	{ value: '3', label: 'мастера' },
	{ value: '900+', label: 'клиентов в месяц' },
];

/* ── Хроника: четыре главы ────────────────────────────────────────────
   Заголовки глав утверждены Кириллом. Метка (`mark`) стоит в самой главе,
   короткая подпись на шкале времени (`rail`) — рядом с точкой шкалы.
   Кадры: chapter-01..04 из загрузок, 1066×1600 (портрет), q80, метаданные
   сняты. Порядок кадров задан Кириллом. Alt нейтральный: называет главу и не
   выдумывает, что именно в кадре. */
export type ManifestChapter = {
	id: ManifestParagraphId;
	mark: string;
	rail: string;
	title: string;
	text: string;
	photo: ImageMetadata;
	alt: string;
};

const chapterMeta: Array<{
	id: ManifestParagraphId;
	mark: string;
	rail: string;
	title: string;
	photo: ImageMetadata;
}> = [
	{ id: 'founding', mark: '2014', rail: '2014', title: 'Подвал на Никольской', photo: chapter01 },
	{ id: 'craft', mark: 'глава 02', rail: '02', title: 'Форма и время', photo: chapter02 },
	{ id: 'tool', mark: 'глава 03', rail: '03', title: 'Свой инструмент', photo: chapter03 },
	{ id: 'honesty', mark: 'глава 04', rail: '04', title: 'Честный ответ', photo: chapter04 },
];

export const manifestChapters: ManifestChapter[] = chapterMeta.map((meta) => ({
	...meta,
	text: paragraphById(meta.id).text,
	alt: `Барбершоп «Мьёльнир», глава «${meta.title}» — кадр хроники`,
}));

/* Подписи глав и метки для прототипов: одна правда на все страницы. */
export const manifestChapterTitles: Record<ManifestParagraphId, string> = {
	founding: chapterMeta[0].title,
	craft: chapterMeta[1].title,
	tool: chapterMeta[2].title,
	honesty: chapterMeta[3].title,
};

export const manifestChapterMarks: Record<ManifestParagraphId, string> = {
	founding: chapterMeta[0].mark,
	craft: chapterMeta[1].mark,
	tool: chapterMeta[2].mark,
	honesty: chapterMeta[3].mark,
};

/* D: заголовки четырёх правил — фрагменты самих абзацев (прототип концепции D). */
export const manifestRuleTitles: Record<ManifestParagraphId, string> = {
	founding: 'Один мастер, один клиент, одно кресло',
	craft: 'Не услуга за пятнадцать минут',
	tool: 'Только инструмент, которым пользуемся сами',
	honesty: 'Скажем честно, если форма не сядет',
};

/* B: какие абзацы раскрывает каждая метка-цифра (прототип концепции B).
   2014 — основание и правило; «3» — почему трём мастерам хватает времени
   на форму и инструмент; «900+» — почему возвращаются. */
export const manifestMarkPanels: ManifestParagraphId[][] = [
	['founding'],
	['craft', 'tool'],
	['honesty'],
];
