// Rear camera acquisition plus the black-frame probe used to verify the
// Telegram iOS WebView risk described in tech.md section 6.

/** Average luma (0..255) below which a sampled frame counts as black. */
export const BLACK_LUMA_THRESHOLD = 6;
/** Number of frames sampled before deciding the stream is black. */
export const BLACK_PROBE_COUNT = 5;
/** Delay between two samples, ms. */
export const BLACK_PROBE_INTERVAL_MS = 200;
/** Downscaled canvas edge used for sampling — a rough average is enough. */
export const PROBE_CANVAS_SIZE = 64;
/** How long to wait for the first decodable video frame, ms. */
export const VIDEO_READY_TIMEOUT_MS = 8000;

/** Which physical camera to open. The counter uses the rear one; the front one is for checking the overlay. */
export type CameraFacing = 'environment' | 'user';

export type CameraErrorKind =
	'unsupported' | 'permission-denied' | 'not-found' | 'timeout' | 'unknown';

export class CameraError extends Error {
	readonly kind: CameraErrorKind;

	constructor(kind: CameraErrorKind, message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = 'CameraError';
		this.kind = kind;
	}
}

export interface CameraStreamInfo {
	width: number;
	height: number;
	frameRate: number;
	facingMode: string;
	label: string;
}

export interface BlackFrameProbeResult {
	isBlack: boolean;
	averageLuma: number;
	maxLuma: number;
	samples: number[];
}

function buildConstraints(facing: CameraFacing): MediaStreamConstraints {
	return {
		// `ideal` rather than `exact`: desktop machines used for development have
		// only one camera and would otherwise fail with OverconstrainedError.
		video: {
			facingMode: { ideal: facing },
			width: { ideal: 1280 },
			height: { ideal: 720 }
		},
		audio: false
	};
}

export async function startCamera(facing: CameraFacing): Promise<MediaStream> {
	if (!navigator.mediaDevices?.getUserMedia) {
		throw new CameraError(
			'unsupported',
			'getUserMedia is unavailable — the page must be served over HTTPS.'
		);
	}

	try {
		return await navigator.mediaDevices.getUserMedia(buildConstraints(facing));
	} catch (error) {
		throw new CameraError(classifyGetUserMediaError(error), describeError(error), { cause: error });
	}
}

export function stopStream(stream: MediaStream | null): void {
	stream?.getTracks().forEach((track) => track.stop());
}

export function describeStream(stream: MediaStream | null): CameraStreamInfo | null {
	const track = stream?.getVideoTracks()[0];
	if (!track) return null;

	const settings = track.getSettings();

	return {
		width: settings.width ?? 0,
		height: settings.height ?? 0,
		frameRate: Math.round(settings.frameRate ?? 0),
		facingMode: settings.facingMode ?? 'unknown',
		label: track.label || 'unnamed'
	};
}

/** Resolves once the video element has decoded a frame with non-zero dimensions. */
export function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
	if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
		return Promise.resolve();
	}

	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			cleanup();
			reject(new CameraError('timeout', 'The camera stream produced no frame in time.'));
		}, VIDEO_READY_TIMEOUT_MS);

		const onReady = () => {
			if (video.videoWidth === 0) return;
			cleanup();
			resolve();
		};

		const cleanup = () => {
			clearTimeout(timer);
			video.removeEventListener('loadeddata', onReady);
			video.removeEventListener('canplay', onReady);
		};

		video.addEventListener('loadeddata', onReady);
		video.addEventListener('canplay', onReady);
	});
}

/**
 * Samples a few frames and reports whether the stream is effectively black.
 * A black stream means the WebView handed us a track that carries no picture —
 * the known Telegram iOS failure mode.
 */
export async function probeBlackFrames(video: HTMLVideoElement): Promise<BlackFrameProbeResult> {
	const canvas = document.createElement('canvas');
	canvas.width = PROBE_CANVAS_SIZE;
	canvas.height = PROBE_CANVAS_SIZE;

	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) {
		throw new CameraError('unsupported', '2D canvas context is unavailable.');
	}

	const samples: number[] = [];

	for (let i = 0; i < BLACK_PROBE_COUNT; i += 1) {
		if (i > 0) await delay(BLACK_PROBE_INTERVAL_MS);
		context.drawImage(video, 0, 0, canvas.width, canvas.height);
		samples.push(averageLuma(context.getImageData(0, 0, canvas.width, canvas.height)));
	}

	const maxLuma = Math.max(...samples);
	const averageOfSamples = samples.reduce((sum, value) => sum + value, 0) / samples.length;

	return {
		isBlack: maxLuma < BLACK_LUMA_THRESHOLD,
		averageLuma: round(averageOfSamples),
		maxLuma: round(maxLuma),
		samples: samples.map(round)
	};
}

function averageLuma(image: ImageData): number {
	const { data } = image;
	let total = 0;

	for (let i = 0; i < data.length; i += 4) {
		// Rec. 601 luma — matches how a human reads brightness closely enough here.
		total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
	}

	return total / (data.length / 4);
}

function classifyGetUserMediaError(error: unknown): CameraErrorKind {
	if (!(error instanceof DOMException)) return 'unknown';

	switch (error.name) {
		case 'NotAllowedError':
		case 'SecurityError':
			return 'permission-denied';
		case 'NotFoundError':
		case 'OverconstrainedError':
		case 'DevicesNotFoundError':
			return 'not-found';
		default:
			return 'unknown';
	}
}

function describeError(error: unknown): string {
	if (error instanceof DOMException) return `${error.name}: ${error.message}`;
	if (error instanceof Error) return error.message;
	return String(error);
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}
