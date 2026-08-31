<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { applyThemeParams, initWebApp } from '$lib/telegram/webapp';

	let { children } = $props();

	$effect(() => {
		applyThemeParams(initWebApp());
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Push-up Counter</title>
</svelte:head>

{@render children()}

<style>
	:global(:root) {
		--tg-bg: #17212b;
		--tg-text: #ffffff;
		--tg-hint: #8a8a8e;
		--tg-button: #2ea6ff;
		--tg-button-text: #ffffff;
		--ok: #4caf50;
		--warn: #ffb300;
		--error: #ff5252;
	}

	:global(body) {
		margin: 0;
		background: var(--tg-bg);
		color: var(--tg-text);
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
		-webkit-text-size-adjust: 100%;
	}
</style>
