// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { TelegramWebApp } from '$lib/telegram/webapp';

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		Telegram?: {
			WebApp: TelegramWebApp;
		};
	}
}

export {};
