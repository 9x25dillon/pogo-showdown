import { defineConfig } from 'vite';

// base './' so the built index.html uses relative asset paths,
// which is required when Capacitor serves dist/ from the Android WebView.
export default defineConfig({
  base: './',
});
