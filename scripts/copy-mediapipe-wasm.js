// Copies the MediaPipe vision WASM runtime from node_modules into static/, so the
// app serves it from its own origin instead of a CDN — one less thing that can
// fail inside the Telegram WebView, and the runtime always matches the installed
// @mediapipe/tasks-vision version.
//
// FilesetResolver picks the SIMD build and falls back to the nosimd one, so both
// variants are required. The "_module" variants are only used by the module
// runtime, which this app does not request.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILES = [
	'vision_wasm_internal.js',
	'vision_wasm_internal.wasm',
	'vision_wasm_nosimd_internal.js',
	'vision_wasm_nosimd_internal.wasm'
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const target = join(root, 'static', 'mediapipe', 'wasm');

if (!existsSync(source)) {
	console.error(`MediaPipe WASM runtime not found at ${source}. Run npm install first.`);
	process.exit(1);
}

mkdirSync(target, { recursive: true });

for (const file of FILES) {
	copyFileSync(join(source, file), join(target, file));
}

console.log(`Copied ${FILES.length} MediaPipe WASM files to static/mediapipe/wasm.`);
