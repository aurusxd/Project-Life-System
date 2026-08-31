<script lang="ts">
	import { DrawingUtils, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';

	interface Props {
		/** Active camera stream, or null when the camera is stopped. */
		stream: MediaStream | null;
		/** The underlying video element, exposed for frame sampling and pose detection. */
		video?: HTMLVideoElement | null;
		/** Landmarks of the tracked pose, drawn as a skeleton over the video. */
		landmarks?: NormalizedLandmark[] | null;
		/** Mirrors the view, as expected of a front camera. */
		mirrored?: boolean;
	}

	let { stream, video = $bindable(null), landmarks = null, mirrored = false }: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let drawingUtils: DrawingUtils | null = null;

	const SKELETON_COLOR = '#4caf50';
	const LANDMARK_COLOR = '#ffb300';

	$effect(() => {
		if (!video) return;
		video.srcObject = stream;
		if (stream) video.play().catch(() => undefined);
	});

	$effect(() => {
		if (!canvas || !video) return;
		draw(canvas, video, landmarks);
	});

	function draw(
		target: HTMLCanvasElement,
		source: HTMLVideoElement,
		pose: NormalizedLandmark[] | null
	): void {
		// The canvas keeps the video's intrinsic size and is laid over it with the
		// same object-fit, so landmark coordinates map one to one.
		if (target.width !== source.videoWidth || target.height !== source.videoHeight) {
			target.width = source.videoWidth;
			target.height = source.videoHeight;
			drawingUtils = null;
		}

		const context = target.getContext('2d');
		if (!context) return;

		context.clearRect(0, 0, target.width, target.height);
		if (!pose) return;

		drawingUtils ??= new DrawingUtils(context);
		const scale = Math.max(2, target.width / 240);

		drawingUtils.drawConnectors(pose, PoseLandmarker.POSE_CONNECTIONS, {
			color: SKELETON_COLOR,
			lineWidth: scale
		});
		drawingUtils.drawLandmarks(pose, { color: LANDMARK_COLOR, radius: scale });
	}
</script>

<div class="camera-view" class:mirrored>
	<!-- muted + playsinline are required for autoplay on iOS. -->
	<video bind:this={video} autoplay playsinline muted></video>
	<canvas bind:this={canvas}></canvas>
	{#if !stream}
		<div class="placeholder">Camera is off</div>
	{/if}
</div>

<style>
	.camera-view {
		position: relative;
		width: 100%;
		aspect-ratio: 4 / 3;
		overflow: hidden;
		border-radius: 12px;
		background: #000;
	}

	video,
	canvas {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	canvas {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	/* Video and overlay get the same flip, so the landmarks stay aligned with the
	   picture; the placeholder text is left readable. */
	.camera-view.mirrored video,
	.camera-view.mirrored canvas {
		transform: scaleX(-1);
	}

	.placeholder {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: var(--tg-hint, #8a8a8e);
		font-size: 0.9rem;
	}
</style>
