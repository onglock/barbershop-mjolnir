import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { useInView, useReducedMotion } from 'framer-motion';
import * as THREE from 'three';

const ACCENT = '#DCA657'; // латунь — единственный акцент проекта
const WOOD = '#3A2E24'; // рукоятка

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
 * Молот из двух примитивов: голова — параллелепипед, рукоятка — цилиндр.
 * Вращение по Y 0.3 об/сек, колебание по X ±5°, плюс параллакс по курсору
 * с lerp 0.05. Все три движения — на отдельных группах, чтобы не спорить.
 */
function Hammer({ pointer, reduced }: { pointer: Pointer; reduced: boolean }) {
	const parallax = useRef<THREE.Group>(null);
	const spinner = useRef<THREE.Group>(null);
	const smooth = useRef({ x: 0, y: 0 });

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
				<group ref={spinner} position={[0, 0.55, 0]} scale={0.82}>
					{/* Голова молота */}
					<mesh position={[0, 0.45, 0]}>
						<boxGeometry args={[1.5, 0.9, 0.9]} />
						<meshStandardMaterial
							color={ACCENT}
							metalness={0.7}
							roughness={0.28}
							envMapIntensity={1.8}
						/>
					</mesh>
					{/* Боёк, которым бьют — круглый, чуть вынесен вбок */}
					<mesh position={[-0.85, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.47, 0.47, 0.3, 32]} />
						<meshStandardMaterial
							color={ACCENT}
							metalness={0.78}
							roughness={0.2}
							envMapIntensity={1.8}
						/>
					</mesh>
					{/* Затылок с проушиной */}
					<mesh position={[0.95, 0.42, 0]}>
						<boxGeometry args={[0.5, 0.62, 0.62]} />
						<meshStandardMaterial
							color={ACCENT}
							metalness={0.72}
							roughness={0.32}
							envMapIntensity={1.8}
						/>
					</mesh>
					{/* Рукоятка */}
					<mesh position={[0, -0.78, 0]}>
						<cylinderGeometry args={[0.18, 0.22, 2.2, 32]} />
						<meshStandardMaterial color={WOOD} metalness={0.1} roughness={0.85} />
					</mesh>
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
							<meshBasicMaterial color="#07090C" side={THREE.BackSide} />
						</mesh>
						{/* Мягкий тёплый источник сверху-слева */}
						<mesh position={[-8, 10, 4]}>
							<planeGeometry args={[22, 22]} />
							<meshBasicMaterial color="#C8A16A" />
						</mesh>
						{/* Узкая яркая полоса: даёт резкий блик на грани головы */}
						<mesh position={[-2, 5, 6]} rotation={[0, 0, -0.7]}>
							<planeGeometry args={[0.7, 14]} />
							<meshBasicMaterial color="#FFE9C4" />
						</mesh>
						{/* Холодная подсветка справа, чтобы металл не был одноцветным */}
						<mesh position={[8, -2, 5]}>
							<planeGeometry args={[10, 10]} />
							<meshBasicMaterial color="#5A646E" />
						</mesh>
						<mesh position={[0, 0, -10]}>
							<planeGeometry args={[20, 12]} />
							<meshBasicMaterial color="#141920" />
						</mesh>
					</Environment>

					<ambientLight intensity={0.3} />
					<directionalLight position={[-4, 6, 3]} intensity={1.6} />
					<pointLight position={[4, 1, 2]} intensity={25} color={ACCENT} distance={14} />
					<pointLight position={[-2.5, 3.5, 4]} intensity={18} color="#FFF1D6" distance={12} />

					<Hammer pointer={pointer} reduced={reduced} />
				</Canvas>
			)}
		</div>
	);
}
