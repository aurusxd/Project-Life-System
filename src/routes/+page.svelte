<script lang="ts">
	import { tick } from 'svelte';
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
	import {
		describeEnvironment,
		openInExternalBrowser,
		type EnvironmentInfo
	} from '$lib/telegram/webapp';

	// Stage 1 screen: verifies the Telegram iOS WebView camera risk (tech.md section 6).
	type CheckStatus = 'idle' | 'starting' | 'probing' | 'live' | 'black' | 'error';

	let status = $state<CheckStatus>('idle');
	let stream = $state<MediaStream | null>(null);
	let video = $state<HTMLVideoElement | null>(null);
	let streamInfo = $state<CameraStreamInfo | null>(null);
	let probe = $state<BlackFrameProbeResult | null>(null);
	let errorMessage = $state('');
	let copied = $state(false);

	// Fixed for the lifetime of the page: describes the client the check runs in.
	const environment: EnvironmentInfo = describeEnvironment();

	const busy = $derived(status === 'starting' || status === 'probing');
	const failed = $derived(status === 'black' || status === 'error');

	async function start(): Promise<void> {
		reset();
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
			status = probe.isBlack ? 'black' : 'live';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
			status = 'error';
			stop();
		}
	}

	function stop(): void {
		stopStream(stream);
		stream = null;
	}

	function reset(): void {
		stop();
		streamInfo = null;
		probe = null;
		errorMessage = '';
		copied = false;
		status = 'idle';
	}

	function buildReport(): string {
		const lines = [
			`status: ${status}`,
			`inTelegram: ${environment.inTelegram}`,
			`platform: ${environment.platform}`,
			`tgVersion: ${environment.version}`,
			`secureContext: ${environment.secureContext}`,
			`mediaDevices: ${environment.mediaDevicesAvailable}`,
			`userAgent: ${environment.userAgent}`
		];

		if (streamInfo) {
			lines.push(
				`stream: ${streamInfo.width}x${streamInfo.height} @${streamInfo.frameRate}fps`,
				`facingMode: ${streamInfo.facingMode}`,
				`track: ${streamInfo.label}`
			);
		}

		if (probe) {
			lines.push(
				`black: ${probe.isBlack}`,
				`luma avg/max: ${probe.averageLuma}/${probe.maxLuma}`,
				`samples: ${probe.samples.join(', ')}`
			);
		}

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
	<h1>Camera check</h1>
	<p class="subtitle">
		Step 1: confirm the rear camera delivers a real picture inside the Telegram WebView.
	</p>

	<CameraView {stream} bind:video />

	<div class="status" data-state={status}>
		{#if status === 'idle'}
			Ready to start.
		{:else if status === 'starting'}
			Requesting the camera…
		{:else if status === 'probing'}
			Checking the stream for black frames…
		{:else if status === 'live'}
			Camera works — the stream carries a picture.
		{:else if status === 'black'}
			The stream is black. This is the known Telegram iOS WebView failure.
		{:else}
			Camera error: {errorMessage}
		{/if}
	</div>

	<div class="actions">
		{#if stream}
			<button onclick={reset}>Stop</button>
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

	.status[data-state='live'] {
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
