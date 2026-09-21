/**
 * Синтез звука подхвата для магнитных кнопок (§10.1).
 *
 * Никаких mp3 и внешних ассетов — только осцилляторы, шум и фильтры.
 * Три слоя: металлический удар (шум через bandpass), низкий гул (синус 70 Гц)
 * и лёгкий звон (800 + 1200 Гц). Ощущение «Тор ловит молот».
 *
 * AudioContext создаётся один раз и разблокируется на первый pointerdown
 * где угодно на странице — до этого playMagneticCatch() молча выходит.
 */

const NOISE_SECONDS = 0.3;

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let armed = false;

function getCtx(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	if (ctx) return ctx;
	const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!Ctor) return null;
	ctx = new Ctor();
	return ctx;
}

function getNoise(audio: AudioContext): AudioBuffer {
	if (noiseBuffer) return noiseBuffer;
	const frames = Math.floor(audio.sampleRate * NOISE_SECONDS);
	const buffer = audio.createBuffer(1, frames, audio.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
	noiseBuffer = buffer;
	return buffer;
}

/** Разблокировка по первому действию пользователя. Вызывается из Layout. */
export function armMagneticSound(): void {
	if (typeof window === 'undefined' || armed) return;
	armed = true;
	const unlock = () => {
		const audio = getCtx();
		if (audio && audio.state === 'suspended') void audio.resume();
		window.removeEventListener('pointerdown', unlock);
		window.removeEventListener('keydown', unlock);
	};
	window.addEventListener('pointerdown', unlock, { once: true });
	window.addEventListener('keydown', unlock, { once: true });
}

export function isMagneticSoundReady(): boolean {
	return Boolean(ctx && ctx.state === 'running');
}

/** Металлический «клац». Если контекст не разблокирован — тихо выходим. */
export function playMagneticCatch(): void {
	const audio = ctx;
	if (!audio || audio.state !== 'running') return;

	const now = audio.currentTime;
	const master = audio.createGain();
	master.gain.value = 0.5;
	master.connect(audio.destination);

	// 1. Удар: белый шум через bandpass с высокой добротностью
	const noise = audio.createBufferSource();
	noise.buffer = getNoise(audio);
	const band = audio.createBiquadFilter();
	band.type = 'bandpass';
	band.frequency.value = 2400;
	band.Q.value = 9;
	const noiseGain = audio.createGain();
	noiseGain.gain.setValueAtTime(0.0001, now);
	noiseGain.gain.exponentialRampToValueAtTime(0.32, now + 0.004);
	noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
	noise.connect(band).connect(noiseGain).connect(master);
	noise.start(now);
	noise.stop(now + 0.2);

	// 2. Низкий гул: нарастает за 30 мс, гаснет за 150 мс
	const low = audio.createOscillator();
	low.type = 'sine';
	low.frequency.value = 70;
	const lowGain = audio.createGain();
	lowGain.gain.setValueAtTime(0.0001, now);
	lowGain.gain.linearRampToValueAtTime(0.3, now + 0.03);
	lowGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
	low.connect(lowGain).connect(master);
	low.start(now);
	low.stop(now + 0.22);

	// 3. Звон: две тихие синусоиды с экспоненциальным затуханием
	for (const [freq, level] of [
		[800, 0.05],
		[1200, 0.035],
	] as const) {
		const ring = audio.createOscillator();
		ring.type = 'sine';
		ring.frequency.value = freq;
		const ringGain = audio.createGain();
		ringGain.gain.setValueAtTime(level, now);
		ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
		ring.connect(ringGain).connect(master);
		ring.start(now);
		ring.stop(now + 0.22);
	}
}
