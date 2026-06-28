import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL || 'http://127.0.0.1:8787';

  return {
    base: './',
    server: {
      host: '127.0.0.1',
      port: 5174,
      proxy: {
        '/v1': {
          target: apiTarget,
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});
