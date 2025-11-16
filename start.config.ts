import { defineConfig } from '@tanstack/react-start/config';

export default defineConfig({
  server: {
    preset: 'netlify',
  },
  react: {
    // This is critical - enables streaming for Suspense
    babel: {
      plugins: [['babel-plugin-react-compiler', {}]],
    },
  },
  ssr: true,
  // Add streaming support
  streaming: true,
});
