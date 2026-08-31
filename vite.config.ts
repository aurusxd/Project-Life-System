import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// All SvelteKit configuration lives here: when options are passed to `sveltekit()`,
// SvelteKit ignores a separate svelte.config.js file. Kit options are passed flat,
// alongside the options forwarded to vite-plugin-svelte.
export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries.
				runes: ({ filename }) => (filename.includes('node_modules') ? undefined : true)
			},

			// Fully client-side app (camera + on-device inference), served as a static SPA.
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				fallback: 'index.html',
				precompress: false,
				strict: false
			})
		})
	]
});
