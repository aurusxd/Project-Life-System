// PoseLandmarker setup and per-frame detection.
//
// Both the WASM runtime and the model are served from this origin (see
// scripts/copy-mediapipe-wasm.js): no CDN request has to succeed inside the
// Telegram WebView for the app to start.

import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { base } from '$app/paths';

export const WASM_DIRECTORY = `${base}/mediapipe/wasm`;
export const MODEL_PATH = `${base}/models/pose_landmarker_lite.task`;

/** Only one person is ever in frame, and tracking a single pose keeps the phone cool. */
export const DETECTION_OPTIONS = {
	numPoses: 1,
	minPoseDetectionConfidence: 0.5,
	minPosePresenceConfidence: 0.5,
	minTrackingConfidence: 0.5
} as const;

export type PoseDelegate = 'GPU' | 'CPU';

export interface PoseDetector {
	/** Which backend the model actually runs on — GPU is expected, CPU is the fallback. */
	readonly delegate: PoseDelegate;
	/** Landmarks of the single tracked pose, or null when nobody is detected. */
	detect(video: HTMLVideoElement, timestampMs: number): NormalizedLandmark[] | null;
	close(): void;
}

/**
 * Loads the model, preferring the GPU delegate and falling back to CPU when the
 * WebView refuses to give us a WebGL context.
 */
export async function createPoseDetector(): Promise<PoseDetector> {
	const fileset = await FilesetResolver.forVisionTasks(WASM_DIRECTORY);

	let landmarker: PoseLandmarker;
	let delegate: PoseDelegate = 'GPU';

	try {
		landmarker = await createLandmarker(fileset, 'GPU');
	} catch {
		landmarker = await createLandmarker(fileset, 'CPU');
		delegate = 'CPU';
	}

	// detectForVideo rejects timestamps that do not move forward.
	let lastTimestamp = -1;

	return {
		delegate,
		detect(video, timestampMs) {
			if (timestampMs <= lastTimestamp) return null;
			lastTimestamp = timestampMs;

			const result = landmarker.detectForVideo(video, timestampMs);
			return result.landmarks[0] ?? null;
		},
		close() {
			landmarker.close();
		}
	};
}

function createLandmarker(
	fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
	delegate: PoseDelegate
): Promise<PoseLandmarker> {
	return PoseLandmarker.createFromOptions(fileset, {
		baseOptions: { modelAssetPath: MODEL_PATH, delegate },
		runningMode: 'VIDEO',
		...DETECTION_OPTIONS
	});
}

export interface DetectionFrame {
	landmarks: NormalizedLandmark[] | null;
	/** Smoothed detection rate, frames per second. */
	fps: number;
}

/**
 * Runs detection on every new video frame until the returned function is called.
 * Frames are skipped while the video has not advanced, so a stalled stream costs
 * nothing.
 */
export function startDetectionLoop(
	video: HTMLVideoElement,
	detector: PoseDetector,
	onFrame: (frame: DetectionFrame) => void
): () => void {
	let handle = 0;
	let running = true;
	let lastVideoTime = -1;
	let lastFrameAt = 0;
	let fps = 0;

	const tick = () => {
		if (!running) return;
		handle = requestAnimationFrame(tick);

		if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
		if (video.currentTime === lastVideoTime) return;
		lastVideoTime = video.currentTime;

		const now = performance.now();
		const landmarks = detector.detect(video, now);

		if (lastFrameAt > 0) {
			const instantFps = 1000 / (now - lastFrameAt);
			// Exponential smoothing: the raw value jitters too much to read.
			fps = fps === 0 ? instantFps : fps * 0.9 + instantFps * 0.1;
		}
		lastFrameAt = now;

		onFrame({ landmarks, fps: Math.round(fps) });
	};

	handle = requestAnimationFrame(tick);

	return () => {
		running = false;
		cancelAnimationFrame(handle);
	};
}
