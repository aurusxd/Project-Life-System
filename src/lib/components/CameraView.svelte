<script lang="ts">
	interface Props {
		/** Active camera stream, or null when the camera is stopped. */
		stream: MediaStream | null;
		/** The underlying video element, exposed for frame sampling and pose detection. */
		video?: HTMLVideoElement | null;
	}

	let { stream, video = $bindable(null) }: Props = $props();

	$effect(() => {
		if (!video) return;
		video.srcObject = stream;
	});
</script>

<div class="camera-view">
	<!-- muted + playsinline are required for autoplay on iOS. -->
	<video bind:this={video} autoplay playsinline muted></video>
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

	video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
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
