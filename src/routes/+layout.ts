// The app is a static SPA: everything (camera, on-device inference) runs in the
// browser, so there is nothing to render or prerender on the server. The single
// index.html shell is emitted by adapter-static's fallback.
export const ssr = false;
export const prerender = false;
