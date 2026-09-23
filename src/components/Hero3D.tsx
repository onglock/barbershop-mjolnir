import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
const MODEL_HEIGHT = 3.05;

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
function Hammer({ pointer, reduced }: { pointer: Pointer; reduced: boolean }) {
	const parallax = useRef<THREE.Group>(null);
	const spinner = useRef<THREE.Group>(null);
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

	useFrame((state, delta) => {
		const t = state.clock.elapsedTime;
		const p = pointer.current;

		if (parallax.current) {
			// lerp 0.05 — мягкая догоняющая реакция на курсор
			smooth.current.x += (p.x * 0.45 - smooth.current.x) * 0.05;
			smooth.current.y += (p.y * 0.3 - smooth.current.y) * 0.05;
			parallax.current.position.x = smooth.current.x;
			parallax.current.position.y = smooth.current.y * -0.5;
			parallax.current.rotation.y = smooth.current.x * 0.25;
		}

		if (spinner.current && !reduced) {
			spinner.current.rotation.y += delta * 0.3 * Math.PI * 2; // 0.3 об/сек
			spinner.current.rotation.x = Math.sin(t * 0.6) * THREE.MathUtils.degToRad(5);
		}
	});

	return (
		<group ref={parallax}>
			{/* Наклон оси: молот смотрится объёмнее, чем в лоб */}
			<group rotation={[0.12, 0, -0.22]}>
				<group ref={spinner}>
					<primitive object={prepared} />
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
	const pointer = useRef({ x: 0, y: 0 });

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
			className="pointer-events-none absolute inset-y-0 right-0 z-[2] hidden w-1/2 lg:block"
		>
			{ready && (
				<Canvas
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
						<Hammer pointer={pointer} reduced={reduced} />
					</Suspense>
				</Canvas>
			)}
		</div>
	);
}

useGLTF.preload(MODEL_URL);
