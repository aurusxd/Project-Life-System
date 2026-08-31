// Minimal typed wrapper around the Telegram WebApp SDK.
//
// The SDK script is loaded from telegram.org in app.html, so `window.Telegram` is
// absent when the app runs in a plain browser (or when the script fails to load).
// Every accessor here tolerates that and degrades to a normal web page.

export interface TelegramThemeParams {
	bg_color?: string;
	text_color?: string;
	hint_color?: string;
	link_color?: string;
	button_color?: string;
	button_text_color?: string;
	secondary_bg_color?: string;
}

export interface TelegramWebApp {
	initData: string;
	version: string;
	platform: string;
	colorScheme: 'light' | 'dark';
	themeParams: TelegramThemeParams;
	isExpanded: boolean;
	viewportHeight: number;
	ready(): void;
	expand(): void;
	openLink(url: string, options?: { try_instant_view?: boolean }): void;
	// Available from Bot API 7.7 only.
	disableVerticalSwipes?(): void;
}

export interface EnvironmentInfo {
	inTelegram: boolean;
	platform: string;
	version: string;
	colorScheme: string;
	userAgent: string;
	secureContext: boolean;
	mediaDevicesAvailable: boolean;
}

export function getWebApp(): TelegramWebApp | null {
	if (typeof window === 'undefined') return null;
	return window.Telegram?.WebApp ?? null;
}

/** True when running inside a real Telegram client, not just with the SDK loaded. */
export function isTelegramWebView(): boolean {
	const webApp = getWebApp();
	return Boolean(webApp && webApp.platform && webApp.platform !== 'unknown');
}

/** Tells Telegram the app is rendered and asks for the full viewport height. */
export function initWebApp(): TelegramWebApp | null {
	const webApp = getWebApp();
	if (!webApp) return null;

	webApp.ready();
	webApp.expand();
	// A swipe-down over the camera view would otherwise close the mini app.
	webApp.disableVerticalSwipes?.();

	return webApp;
}

/**
 * Opens a URL outside of the Telegram WebView (Safari on iOS).
 * Fallback path for the black-camera-stream risk, see tech.md section 6.
 */
export function openInExternalBrowser(url: string = window.location.href): void {
	const webApp = getWebApp();
	if (webApp) {
		webApp.openLink(url);
		return;
	}
	window.open(url, '_blank', 'noopener');
}

export function describeEnvironment(): EnvironmentInfo {
	const webApp = getWebApp();

	return {
		inTelegram: isTelegramWebView(),
		platform: webApp?.platform ?? 'none',
		version: webApp?.version ?? 'none',
		colorScheme: webApp?.colorScheme ?? 'none',
		userAgent: navigator.userAgent,
		secureContext: window.isSecureContext,
		mediaDevicesAvailable: Boolean(navigator.mediaDevices?.getUserMedia)
	};
}

/** Applies Telegram theme colors as CSS custom properties on the document root. */
export function applyThemeParams(webApp: TelegramWebApp | null): void {
	if (!webApp) return;

	const root = document.documentElement;
	const { bg_color, text_color, hint_color, button_color, button_text_color } = webApp.themeParams;

	if (bg_color) root.style.setProperty('--tg-bg', bg_color);
	if (text_color) root.style.setProperty('--tg-text', text_color);
	if (hint_color) root.style.setProperty('--tg-hint', hint_color);
	if (button_color) root.style.setProperty('--tg-button', button_color);
	if (button_text_color) root.style.setProperty('--tg-button-text', button_text_color);
}
