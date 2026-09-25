import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Fail closed: the dev CAPTCHA bypass must never ship to production.
  if (mode === 'production' && env.VITE_DISABLE_CAPTCHA === 'true') {
    throw new Error(
      'VITE_DISABLE_CAPTCHA=true must not be set in production. Remove it from your environment before building.'
    );
  }

  return {
    plugins: [react(), basicSsl()],
    server: {
      port: 3000,
      open: false,
      https: true,
    },
    build: {
      rollupOptions: {
        output: {
          // Split heavy third-party deps into standalone chunks so route
          // chunks stay small and vendor code caches across deploys.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('@tanstack/react-query')) return 'vendor-query';
            if (id.includes('node_modules/motion/')) return 'vendor-motion';
            if (id.includes('lucide-react')) return 'vendor-icons';
            return undefined;
          },
        },
      },
    },
  };
});
