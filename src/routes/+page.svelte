<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
	import CameraView from '$lib/components/CameraView.svelte';
	import {
		CameraError,
		describeStream,
		probeBlackFrames,
		startRearCamera,
		stopStream,
		waitForVideoFrame,
		type BlackFrameProbeResult,
		type CameraStreamInfo
	} from '$lib/camera/stream';
	import { createPoseDetector, startDetectionLoop, type PoseDetector } from '$lib/pose/detector';
	import {
		describeEnvironment,
		openInExternalBrowser,
		type EnvironmentInfo
	} from '$lib/telegram/webapp';

	// Stage 2 screen: camera check (tech.md section 6) followed by live pose detection.
	type Status = 'idle' | 'starting' | 'probing' | 'loading' | 'running' | 'black' | 'error';

	let status = $state<Status>('idle');
	let stream = $state<MediaStream | null>(null);
	let video = $state<HTMLVideoElement | null>(null);
	let streamInfo = $state<CameraStreamInfo | null>(null);
	let probe = $state<BlackFrameProbeResult | null>(null);
	let landmarks = $state<NormalizedLandmark[] | null>(null);
	let fps = $state(0);
	let delegate = $state('');
	let modelLoadMs = $state(0);
	let errorMessage = $state('');
	let copied = $state(false);

	let detector: PoseDetector | null = null;
	let stopLoop: (() => void) | null = null;

	// Fixed for the lifetime of the page: describes the client the app runs in.
	const environment: EnvironmentInfo = describeEnvironment();

	const busy = $derived(status === 'starting' || status === 'probing' || status === 'loading');
	const failed = $derived(status === 'black' || status === 'error');
	const posePresent = $derived(landmarks !== null);

	onDestroy(stop);

	async function start(): Promise<void> {
		stop();
		status = 'starting';

		try {
			stream = await startRearCamera();
			streamInfo = describeStream(stream);

			// Let CameraView attach the stream to the video element before sampling it.
			await tick();
			if (!video) throw new CameraError('unknown', 'Video element is not mounted.');

			await waitForVideoFrame(video);

			status = 'probing';
			probe = await probeBlackFrames(video);
			if (probe.isBlack) {
				status = 'black';
				return;
			}

			status = 'loading';
			const startedAt = performance.now();
			detector = await createPoseDetector();
			modelLoadMs = Math.round(performance.now() - startedAt);
			delegate = detector.delegate;

			stopLoop = startDetectionLoop(video, detector, (frame) => {
				landmarks = frame.landmarks;
				fps = frame.fps;
			});
			status = 'running';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
			status = 'error';
			teardown();
		}
	}

	function stop(): void {
		teardown();
		streamInfo = null;
		probe = null;
		errorMessage = '';
		copied = false;
		status = 'idle';
	}

	function teardown(): void {
		stopLoop?.();
		stopLoop = null;
		detector?.close();
		detector = null;
		stopStream(stream);
		stream = null;
		landmarks = null;
		fps = 0;
		delegate = '';
		modelLoadMs = 0;
	}

	function buildReport(): string {
		const lines = [
			`status: ${status}`,
			`inTelegram: ${environment.inTelegram}`,
			`platform: ${environment.platform}`,
			`tgVersion: ${environment.version}`,
			`secureContext: ${environment.secureContext}`,
			`userAgent: ${environment.userAgent}`
		];

		if (streamInfo) {
			lines.push(
				`stream: ${streamInfo.width}x${streamInfo.height} @${streamInfo.frameRate}fps`,
				`facingMode: ${streamInfo.facingMode}`
			);
		}

		if (probe) lines.push(`black: ${probe.isBlack} (luma max ${probe.maxLuma})`);
		if (delegate) lines.push(`delegate: ${delegate}`, `modelLoad: ${modelLoadMs}ms`);
		if (status === 'running') lines.push(`detectFps: ${fps}`, `pose: ${posePresent}`);
		if (errorMessage) lines.push(`error: ${errorMessage}`);

		return lines.join('\n');
	}

	async function copyReport(): Promise<void> {
		try {
			await navigator.clipboard.writeText(buildReport());
			copied = true;
		} catch {
			copied = false;
		}
	}
</script>

<main>
	<h1>Pose detection</h1>
	<p class="subtitle">
		Step 2: the model tracks the body in the camera stream. Lay the phone on the floor on its side
		so the whole body fits in frame.
	</p>

	<CameraView {stream} bind:video {landmarks} />

	<div class="status" data-state={status}>
		{#if status === 'idle'}
			Ready to start.
		{:else if status === 'starting'}
			Requesting the camera…
		{:else if status === 'probing'}
			Checking the stream for black frames…
		{:else if status === 'loading'}
			Loading the pose model…
		{:else if status === 'running'}
			{posePresent ? 'Body tracked' : 'No body in frame'} · {fps} fps · {delegate}
		{:else if status === 'black'}
			The stream is black. This is the known Telegram iOS WebView failure.
		{:else}
			Error: {errorMessage}
		{/if}
	</div>

	<div class="actions">
		{#if stream}
			<button onclick={stop}>Stop</button>
		{:else}
			<button class="primary" onclick={start} disabled={busy}>Start camera</button>
		{/if}

		{#if failed && environment.inTelegram}
			<button onclick={() => openInExternalBrowser()}>Open in Safari</button>
		{/if}
	</div>

	<section class="report">
		<div class="report-head">
			<h2>Diagnostics</h2>
			<button class="link" onclick={copyReport}>{copied ? 'Copied' : 'Copy'}</button>
		</div>
		<pre>{buildReport()}</pre>
	</section>
</main>

<style>
	main {
		max-width: 480px;
		margin: 0 auto;
		padding: 16px 16px 48px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	h1 {
		font-size: 1.25rem;
		margin: 0;
	}

	h2 {
		font-size: 0.9rem;
		margin: 0;
		color: var(--tg-hint);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.subtitle {
		margin: 0;
		color: var(--tg-hint);
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.status {
		font-size: 0.95rem;
		line-height: 1.4;
		padding: 10px 12px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.06);
	}

	.status[data-state='running'] {
		color: var(--ok);
	}

	.status[data-state='black'],
	.status[data-state='error'] {
		color: var(--error);
	}

	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	button {
		flex: 1 1 auto;
		min-height: 44px;
		padding: 0 16px;
		border: none;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.1);
		color: var(--tg-text);
		font-size: 1rem;
		cursor: pointer;
	}

	button.primary {
		background: var(--tg-button);
		color: var(--tg-button-text);
	}

	button.link {
		flex: 0 0 auto;
		min-height: 0;
		padding: 0;
		background: none;
		color: var(--tg-button);
		font-size: 0.85rem;
	}

	button:disabled {
		opacity: 0.5;
	}

	.report {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.report-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	pre {
		margin: 0;
		padding: 10px 12px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.06);
		color: var(--tg-hint);
		font-size: 0.75rem;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
