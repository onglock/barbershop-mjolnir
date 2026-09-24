import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, useGLTF } from '@react-three/drei';
import { useInView, useReducedMotion } from 'framer-motion';
import * as THREE from 'three';

const ACCENT = '#7BA5C9'; // сталь — акцент палитры 1

/** Модель молота: glTF из public/models/hammer.glb (52 284 треугольника, PBR). */
const MODEL_URL = '/models/hammer.glb';

/**
 * Высота модели в единицах сцены. Подобрана от прежних примитивов: при камере
 * fov 30 на дистанции ~10.2 видимая высота ≈ 5.5 единиц, то есть 3.05 даёт
 * молоту примерно половину кадра — те самые 400–500 px на 1280.
 */
const MODEL_HEIGHT = 3.4; /* было 3.05: +11 % к размеру молота */

/* Прилёт (этап 2, десктопная ветка): те же тайминги, что у 2D-молота на мобильном.
   Важно: canvas занимает ВСЮ ширину Hero, поэтому сцена и страница совпадают по X.
   Видимая полуширина сцены при fov 30, z=10.2 и 1280×800 — ≈4,4, то есть левый
   край страницы это x = -4,4. Старт выбран Кириллом на /hero-hammer-start:
   −18,8 — молот идёт из далека (центр ≈ −1786 px, бокс ≈ −1804…−1767, то есть
   ~1,4 ширины кадра за левым краем) и при масштабе 0,05 первое время читается
   точкой. Было −8,4 («вход в кадр на 0,6 с»). */
const FLIGHT_START_X = -18.8;
/* Молот стоит справа: при полной ширине canvas его место в сцене смещено. */
const MODEL_BASE_X = 2.2;
/* Стартовый масштаб 0,05 и кривая роста 40 % — выбор Кирилла (2026-09-24) на
   /hero-hammer-start: молот летит мелким первые 40 % пути (360 мс), затем растёт
   до 1.0 за оставшиеся 60 % (540 мс). Было 0.01 с линейным ростом. */
const FLIGHT_START_SCALE = 0.05;
const FLIGHT_GROW_FROM = 0.4;
const FLIGHT_DELAY_MS = 300;
/* Решение Кирилла (вариант Б, 2026-09-24): звук стартует в клик, полёт укорочен
   с 1400 до 900 мс, чтобы пик звука совпал с посадкой. Пик файла — 1120 мс от
   начала звучания (замер огибающей) плюс ≈90 мс латентности play() → ≈1210 мс,
   посадка = 300 + 900 = 1200 мс. Полёт 820 мс дал бы посадку 1120, то есть на
   90 мс раньше пика — поэтому оставлено 900. */
const FLIGHT_MS = 900;
/* Обороты те же 2800°, поэтому при укороченном полёте вращение ускорилось:
   ≈3100 °/с против ≈2000 °/с при 1400 мс. */
const FLIGHT_TURN_DEG = 2800;

/**
 * Проверка поддержки WebGL. Если её нет — остров отдаёт пустой контейнер,
 * hero остаётся на видео и тексте (см. animation-patterns §8.10).
 * Пробный контекст сразу освобождаем: браузеры держат лимит на число живых
 * WebGL-контекстов, и брошенный пробник съедает место у настоящего canvas.
 */
function hasWebGL() {
	if (typeof window === 'undefined' || !window.WebGLRenderingContext) return false;
	try {
		const probe = document.createElement('canvas');
		const gl = probe.getContext('webgl2') || probe.getContext('webgl');
		if (!gl) return false;
		gl.getExtension('WEBGL_lose_context')?.loseContext();
		return true;
	} catch {
		return false;
	}
}

/**
 * Рендер-драйвер: canvas в режиме frameloop="demand" сам кадры не рисует,
 * поэтому мы просим по кадру только пока hero в зоне видимости.
 * Ушёл из viewport — цикл остановлен, GPU свободен.
 */
function RenderDriver({ active }: { active: boolean }) {
	const invalidate = useThree((state) => state.invalidate);

	useEffect(() => {
		if (!active) return;
		let raf = 0;
		const tick = () => {
			invalidate();
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [active, invalidate]);

	return null;
}

type Pointer = React.MutableRefObject<{ x: number; y: number }>;

/**
 * Молот из .glb-модели. Вращение по Y 0.3 об/сек, колебание по X ±5°, плюс
 * параллакс по курсору с lerp 0.05 — движения те же, что были у примитивов,
 * но объект настоящий.
 *
 * Подготовка модели важна: её нужно отцентровать по габаритному боксу, иначе
 * вращение идёт вокруг чужой точки и молот описывает круг, а не вращается
 * вокруг собственной оси.
 */
function Hammer({ pointer, reduced, runId }: { pointer: Pointer; reduced: boolean; runId: number }) {
	/* Камера и размер канвы — нужны для диагностики: где молот на экране. */
	const { camera, size } = useThree();
	const parallax = useRef<THREE.Group>(null);
	const flyer = useRef<THREE.Group>(null);
	/* Вращение и парение молота. Значения подобраны Кириллом
	   на /hero-rotation-preview: 0.17 об/с, амплитуда 0.08, период 3,5 с. */
	const spinSpeed = useRef(0.17);
	const floatAmp = useRef(0.08);
	const floatPeriod = useRef(3.5);
	/* Фаза молота — явная: idle (до клика в кадре ничего нет), flying, landed.
	   Раньше поза выводилась из flyStart.current, и первые кадры после клика
	   (до срабатывания useEffect) рисовали молот на КОНЕЧНОМ месте — Кирилл
	   видел вспышку на месте перед полётом. Теперь фаза известна до отрисовки:
	   сбрасываем позу в useLayoutEffect, а не в useEffect. */
	const phase = useRef<'idle' | 'flying' | 'landed'>('idle');
	/* Стартовая поза — в ref: на превью /hero-hammer-start её двигают слайдером.
	   Значения по умолчанию — константы FLIGHT_START_X / FLIGHT_START_SCALE. */
	const startX = useRef(FLIGHT_START_X);
	const startScale = useRef(FLIGHT_START_SCALE);
	/* Доля пути, которую молот летит СТАРТОВЫМ размером, прежде чем начать
	   расти: 0 — растёт сразу (линейно), 0.4 — первые 40 % пути мелкий, потом
	   растёт (выбор Кирилла). Подбор — на /hero-hammer-start. */
	const growFrom = useRef(FLIGHT_GROW_FROM);
	/* Дев-режим превью: показать молот в стартовой позе, пока подбирают X. */
	const hold = useRef(false);
	const [holdOn, setHoldOn] = useState(false);
	/* Плавный вход парения после посадки: 0 → 1 за ~1 с. */
	const floatRamp = useRef(0);
	/* До клика молота в сцене нет вовсе (visible={false}). Два источника:
	   attract — настоящий клик по призыву (вместе с полётом), showOnly — показ
	   «на месте» для страницы скорости (/hero-rotation-preview). */
	const [showOnly, setShowOnly] = useState(false);
	const started = runId > 0 || showOnly || holdOn;
	/* Направление кувырка: ?turn=ccw — против часовой. По умолчанию по часовой,
	   как просил Кирилл. Читаем в эффекте, чтобы не ломать SSR. */
	const turn = useRef(FLIGHT_TURN_DEG);
	useEffect(() => {
		if (new URLSearchParams(window.location.search).get('turn') === 'ccw') turn.current = -FLIGHT_TURN_DEG;
	}, []);
	const spinner = useRef<THREE.Group>(null);
	/* Момент старта полёта; null — молот на месте и не летит. */
	const flyStart = useRef<number | null>(null);
	const smooth = useRef({ x: 0, y: 0 });
	/* Второй аргумент — draco, третий — meshopt: модель сжата EXT_meshopt_compression,
	   drei сам подставит лёгкий декодер (~30 КБ против ~250 КБ у draco). */
	const { scene } = useGLTF(MODEL_URL, false, true);

	const prepared = useMemo(() => {
		/* Клон обязателен: useGLTF кэширует сцену и отдаёт один объект на всех. */
		const clone = scene.clone(true);

		clone.traverse((object) => {
			const mesh = object as THREE.Mesh;
			if (!mesh.isMesh) return;
			const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
			if (material) {
				/* Как у прежних примитивов: без отражений металл на тёмном фоне бурый. */
				material.envMapIntensity = 1.8;
				material.needsUpdate = true;
			}
		});

		const box = new THREE.Box3().setFromObject(clone);
		const size = box.getSize(new THREE.Vector3());
		const center = box.getCenter(new THREE.Vector3());
		clone.position.sub(center); // центр модели — в начало координат

		const wrap = new THREE.Group();
		wrap.add(clone);
		wrap.scale.setScalar(MODEL_HEIGHT / Math.max(size.y, 0.0001));
		return wrap;
	}, [scene]);

	/* API скорости вращения для страницы /hero-rotation-preview. */
	useEffect(() => {
		/* Проекция габаритного бокса молота на экран, в пикселях канвы. */
		const projectBox = () => {
			const fly = flyer.current;
			if (!fly) return null;
			const box = new THREE.Box3().setFromObject(fly);
			if (box.isEmpty()) return null;
			let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
			for (let i = 0; i < 8; i++) {
				const v = new THREE.Vector3(
					i & 1 ? box.max.x : box.min.x,
					i & 2 ? box.max.y : box.min.y,
					i & 4 ? box.max.z : box.min.z
				);
				v.project(camera);
				const px = ((v.x + 1) / 2) * size.width;
				const py = ((1 - v.y) / 2) * size.height;
				if (px < left) left = px;
				if (px > right) right = px;
				if (py < top) top = py;
				if (py > bottom) bottom = py;
			}
			return {
				left: Math.round(left), right: Math.round(right),
				top: Math.round(top), bottom: Math.round(bottom),
				width: Math.round(right - left), height: Math.round(bottom - top),
				fullyOffscreen: right < 0 || left > size.width,
			};
		};

		(window as any).__hammerSpin = {
			set: (rev: number) => { spinSpeed.current = rev; },
			get: () => spinSpeed.current,
			/* Показать молот на месте, без прилёта — для страницы скорости. */
			show: () => setShowOnly(true),
			/* Текущий угол поворота (радианы) — для замера фактической скорости. */
			angle: () => (spinner.current ? spinner.current.rotation.y : null),
			/* Парение: настройка и текущая высота. */
			setAmp: (v: number) => { floatAmp.current = v; },
			getAmp: () => floatAmp.current,
			setPeriod: (v: number) => { floatPeriod.current = v; },
			getPeriod: () => floatPeriod.current,
			y: () => (flyer.current ? flyer.current.position.y : null),
			/* Для замеров таймингов: фаза, X, масштаб и метка старта полёта. */
			phase: () => phase.current,
			x: () => (flyer.current ? flyer.current.position.x : null),
			scale: () => (flyer.current ? flyer.current.scale.x : null),
			flyStartAt: () => flyStart.current,
			/* Диагностика (dev): где молот на экране и что видит камера.
			   screen() — положение ЦЕНТРА модели в пикселях канвы от левого и
			   верхнего края; worldX/worldY — координаты сцены; edge() — где
			   проходит край кадра в сцене на глубине молота. */
			screen: () => {
				const fly = flyer.current;
				if (!fly) return null;
				const p = new THREE.Vector3();
				fly.getWorldPosition(p);
				const world = { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
				p.project(camera);
				return {
					x: Math.round(((p.x + 1) / 2) * size.width),
					y: Math.round(((1 - p.y) / 2) * size.height),
					worldX: world.x,
					worldY: world.y,
					ndcX: Math.round(p.x * 1000) / 1000,
					offscreen: p.x < -1,
				};
			},
			camera: () => {
				const c = camera as THREE.PerspectiveCamera;
				return { z: c.position.z, y: c.position.y, fov: c.fov, aspect: Math.round(c.aspect * 1000) / 1000 };
			},
			edge: () => {
				const c = camera as THREE.PerspectiveCamera;
				const halfH = Math.tan(((c.fov / 2) * Math.PI) / 180) * c.position.z;
				const halfW = halfH * c.aspect;
				return {
					halfW: Math.round(halfW * 100) / 100,
					halfH: Math.round(halfH * 100) / 100,
					leftWorldX: Math.round(-halfW * 100) / 100,
					pxPerUnit: Math.round((size.width / (2 * halfW)) * 100) / 100,
				};
			},
			/* Стартовая поза: чтение и правка (превью /hero-hammer-start). */
			getStartX: () => startX.current,
			setStartX: (v: number) => { startX.current = v; },
			getStartScale: () => startScale.current,
			setStartScale: (v: number) => { startScale.current = v; },
			/* Кривая роста: доля пути (0…0.9), которую молот летит стартовым
			   размером, прежде чем начать расти. */
			getGrowFrom: () => growFrom.current,
			setGrowFrom: (v: number) => { growFrom.current = Math.min(0.9, Math.max(0, v)); },
			/* Дев-режим: держать молот в стартовой позе (видно, откуда вылетит). */
			setHold: (on: boolean) => { hold.current = on; setHoldOn(on); },
			getHold: () => hold.current,
			/* Габаритный бокс молота на экране, в пикселях канвы: где он сейчас
			   (в стартовой позе — где он стартует). Считается по реальной
			   геометрии модели, а не по боксу DOM. */
			bbox: projectBox,
			/* Тот же бокс, но В СТАРТОВОЙ ПОЗЕ, независимо от текущей фазы:
			   панель превью должна показывать, откуда молот стартует, а не где
			   он сейчас. Позу применяем на миг и возвращаем — useFrame всё равно
			   переставит её в этом же кадре. */
			startBox: () => {
				const fly = flyer.current;
				if (!fly) return null;
				const keep = { x: fly.position.x, z: fly.rotation.z, s: fly.scale.x };
				fly.position.x = startX.current;
				fly.rotation.z = THREE.MathUtils.degToRad(turn.current);
				fly.scale.setScalar(startScale.current);
				fly.updateMatrixWorld(true);
				const res = projectBox();
				fly.position.x = keep.x;
				fly.rotation.z = keep.z;
				fly.scale.setScalar(keep.s);
				fly.updateMatrixWorld(true);
				return res;
			},
			/* Управление прогоном для превью: сброс в idle и запуск полёта —
			те же события, что у клика по призыву на главной. */
			reset: () => window.dispatchEvent(new CustomEvent('hero:reset')),
			replay: () => {
				window.dispatchEvent(new CustomEvent('hero:reset'));
				/* Запуск — следующим кадром: если отправить оба события в одной
				   задаче, React схлопывает «0, затем +1» в один рендер, счётчик
				   остаётся прежним и полёт не перезапускается. */
				requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('hero:attract')));
			},
			/* Край кадра в пикселях: где начинается видимая часть. */
			viewport: () => ({ width: size.width, height: size.height }),
		};
		return () => { delete (window as any).__hammerSpin; };
	}, []);

	/* Полёт стартует ЗДЕСЬ — до первой отрисовки после клика (useLayoutEffect, а
	   не useEffect: с useEffect успевал пройти кадр, и молот мелькал на конечном
	   месте). Слушатель живёт на верхнем уровне острова (Hero3D): клик, попавший
	   в окно загрузки модели, не теряется, а разыгрывается, когда модель готова.
	   runId = 0 — сброс в idle (молот невидим, стартовая поза), > 0 — номер
	   запуска: каждый запуск увеличивает счётчик, поэтому эффект срабатывает
	   и на повторных кликах (булев флаг не менялся, и полёт «залипал»). */
	useLayoutEffect(() => {
		if (runId === 0) {
			phase.current = 'idle';
			flyStart.current = null;
			delete document.documentElement.dataset.flying;
			return;
		}
		phase.current = 'flying';
		flyStart.current = performance.now();
		document.documentElement.dataset.flying = '1';
	}, [runId]);

	useLayoutEffect(() => {
		if (showOnly) phase.current = 'landed';
	}, [showOnly]);

	useFrame((state, delta) => {
		const t = state.clock.elapsedTime;
		const p = pointer.current;

		if (parallax.current) {
			// lerp 0.05 — мягкая догоняющая реакция на курсор
			smooth.current.x += (p.x * 0.45 - smooth.current.x) * 0.05;
			smooth.current.y += (p.y * 0.3 - smooth.current.y) * 0.05;
			parallax.current.position.x = MODEL_BASE_X + smooth.current.x;
			parallax.current.position.y = smooth.current.y * -0.5;
			parallax.current.rotation.y = smooth.current.x * 0.25;
		}

		if (spinner.current && !reduced) {
			spinner.current.rotation.y += delta * spinSpeed.current * Math.PI * 2;
			spinner.current.rotation.x = Math.sin(t * 0.6) * THREE.MathUtils.degToRad(5);
		}

		/* Парение: только по Y, синус. Начинается после посадки (phase='landed').
		   Вход плавный: амплитуда растёт за ~1 с.
		   prefers-reduced-motion — парения нет. */
		if (flyer.current) {
			const settled = phase.current === 'landed' && !reduced;
			floatRamp.current = THREE.MathUtils.clamp(
				floatRamp.current + (settled ? delta : -delta), 0, 1
			);
			if (floatRamp.current > 0.001) {
				const f = (Math.PI * 2) / Math.max(0.5, floatPeriod.current);
				flyer.current.position.y = Math.sin(t * f) * floatAmp.current * floatRamp.current;
			} else {
				flyer.current.position.y = 0;
			}
		}

		/* Поза по фазе. Конечная поза достижима ТОЛЬКО после посадки: до клика
		   (idle) и в задержке перед полётом молот стоит в стартовой позе — у
		   левого края, сжатый. Полёт: 0,3 с задержки, затем 0,9 с линейно —
		   X к нулю, кувырок по Z (в плоскости экрана), рост startScale → 1.
		   Стартовые X и масштаб берутся из ref — их двигает превью
		   /hero-hammer-start (правило 20.6: варианты показываем живой страницей). */
		const fly = flyer.current;
		if (fly) {
			const setStart = () => {
				fly.position.x = startX.current;
				fly.rotation.z = THREE.MathUtils.degToRad(turn.current);
				fly.scale.setScalar(startScale.current);
			};
			const setEnd = () => {
				fly.position.x = 0; fly.rotation.z = 0; fly.scale.setScalar(1);
			};
			if (hold.current) {
				setStart();
			} else if (reduced) {
				phase.current = 'landed';
				setEnd();
			} else if (phase.current === 'idle') {
				setStart();
			} else if (phase.current === 'landed') {
				setEnd();
			} else {
				const past =
					(performance.now() - (flyStart.current ?? performance.now()) - FLIGHT_DELAY_MS) / FLIGHT_MS;
				if (past < 0) {
					setStart();
				} else if (past < 1) {
					fly.position.x = startX.current * (1 - past);
					fly.rotation.z = THREE.MathUtils.degToRad(turn.current) * (1 - past);
					/* Кривая роста: долю пути growFrom держим стартовый масштаб,
					   дальше растём линейно до 1. При growFrom = 0 это прежняя
					   линейная рампа на весь путь. */
					const g = growFrom.current;
					const k = past <= g ? 0 : (past - g) / (1 - g);
					fly.scale.setScalar(startScale.current + (1 - startScale.current) * k);
				} else {
					phase.current = 'landed';
					flyStart.current = null;
					delete document.documentElement.dataset.flying;
					setEnd();
				}
			}
		}
	});

	return (
		<group ref={parallax}>
			{/* flyer — снаружи наклона оси: кувырок идёт в плоскости экрана, как на мобильном */}
			<group ref={flyer} visible={started}>
				{/* Наклон оси: молот смотрится объёмнее, чем в лоб */}
				<group rotation={[0.12, 0, -0.22]}>
					<group ref={spinner}>
						<primitive object={prepared} />
					</group>
				</group>
			</group>
		</group>
	);
}

export default function Hero3D() {
	const wrapRef = useRef<HTMLDivElement>(null);
	const inView = useInView(wrapRef, { amount: 0.05 });
	const reduced = useReducedMotion() ?? false;
	const [ready, setReady] = useState(false);
	/* Событие клика принимает сам остров, а не Hammer: остров смонтирован
	   всегда, а Hammer — только после загрузки .glb. Иначе клик в окно
	   загрузки модели пропадал (прилёт не проигрывался).
	   Не булев флаг, а счётчик запусков: с флагом повторный клик не менял
	   состояние, эффект не срабатывал и полёт не проигрывался заново — молот
	   «залипал» на месте до перезагрузки страницы. runId = 0 — idle (сброс),
	   каждый запуск увеличивает счётчик (событие hero:attract), hero:reset
	   возвращает в 0. */
	const [runId, setRunId] = useState(0);
	const pointer = useRef({ x: 0, y: 0 });

	useEffect(() => {
		const start = () => setRunId((n) => n + 1);
		const resetRun = () => setRunId(0);
		window.addEventListener('hero:attract', start);
		window.addEventListener('hero:reset', resetRun);
		/* Клик мог случиться раньше, чем остров смонтировался (модель ещё
		   грузилась) — тогда разыгрываем полёт сразу: прилёт не должен пропадать. */
		if ((window as any).__attractFired) start();
		return () => {
			window.removeEventListener('hero:attract', start);
			window.removeEventListener('hero:reset', resetRun);
		};
	}, []);

	/**
	 * Свет: усиленный набор — основной (решение Кирилла 2026-09-22).
	 * ?light=2 — алиас, даёт то же самое; ?light=1 возвращает прежний
	 * приглушённый вариант, чтобы можно было сравнить одной строкой адреса.
	 */
	const boost = useMemo(() => {
		if (typeof window === 'undefined') return 1.5;
		const light = new URLSearchParams(window.location.search).get('light');
		return light === '1' ? 1 : 1.5;
	}, []);

	// Монтируем canvas только на клиенте и только с WebGL: на сервере
	// разметка одинаковая, поэтому рассинхрона при гидратации нет.
	useEffect(() => {
		setReady(hasWebGL());
	}, []);

	// Параллакс слушаем на window: 3D не перехватывает курсор у текста и CTA.
	useEffect(() => {
		if (reduced) return;
		if (!window.matchMedia('(hover: hover) and (min-width: 1024px)').matches) return;

		const onMove = (event: PointerEvent) => {
			pointer.current.x = (event.clientX / window.innerWidth - 0.5) * 2;
			pointer.current.y = (event.clientY / window.innerHeight - 0.5) * 2;
		};
		window.addEventListener('pointermove', onMove, { passive: true });
		return () => window.removeEventListener('pointermove', onMove);
	}, [reduced]);

	return (
		<div
			ref={wrapRef}
			aria-hidden="true"
			className="hero-3d pointer-events-none absolute inset-0 z-[4] hidden lg:block"
		>
			{ready && (
				<Canvas
					/* Клики должны проходить насквозь: R3F ставит канве свой inline
					   pointer-events, поэтому обёртки одной мало. */
					style={{ pointerEvents: 'none' }}
					frameloop="demand"
					dpr={[1, 1.5]}
					gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
					camera={{ position: [0, 1.1, 10.2], fov: 30 }}
					onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
				>
					<RenderDriver active={inView} />

					{/* Своя карта окружения: металл без отражений выглядит бурым.
					    Сцена из четырёх плоскостей запекается в envmap локально,
					    без обращения к CDN drei. */}
					<Environment resolution={64} frames={1}>
						<mesh scale={40}>
							<sphereGeometry args={[1, 24, 24]} />
							<meshBasicMaterial color="#010305" side={THREE.BackSide} />
						</mesh>
						{/* Мягкий тёплый источник сверху-слева */}
						<mesh position={[-8, 10, 4]}>
							<planeGeometry args={[22, 22]} />
							<meshBasicMaterial color="#CC9C42" />
						</mesh>
						{/* Узкая яркая полоса: даёт резкий блик на грани головы */}
						<mesh position={[-2, 5, 6]} rotation={[0, 0, -0.7]}>
							<planeGeometry args={[0.7, 14]} />
							<meshBasicMaterial color="#E8ECEE" />
						</mesh>
						{/* Холодная подсветка справа, чтобы металл не был одноцветным */}
						<mesh position={[8, -2, 5]}>
							<planeGeometry args={[10, 10]} />
							<meshBasicMaterial color="#94999D" />
						</mesh>
						<mesh position={[0, 0, -10]}>
							<planeGeometry args={[20, 12]} />
							<meshBasicMaterial color="#030609" />
						</mesh>
					</Environment>

					<ambientLight intensity={0.3 * boost} />
					<directionalLight position={[-4, 6, 3]} intensity={1.6 * boost} />
					<pointLight position={[4, 1, 2]} intensity={25 * boost} color={ACCENT} distance={14} />
					<pointLight position={[-2.5, 3.5, 4]} intensity={18 * boost} color="#E8ECEE" distance={12} />
					{/* Усиленный режим добавляет контровой свет справа-сзади,
					    чтобы грани головы отделялись от тёмного фона */}
					{boost > 1 && <pointLight position={[3, 2, -3]} intensity={22} color="#CC9C42" distance={16} />}

					<Suspense fallback={null}>
						<Hammer pointer={pointer} reduced={reduced} runId={runId} />
					</Suspense>
				</Canvas>
			)}
		</div>
	);
}

useGLTF.preload(MODEL_URL);
