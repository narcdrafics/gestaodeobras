import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'js', dest: '' },
        { src: 'css', dest: '' },
        { src: 'img', dest: '' },
        { src: 'pages', dest: '' },
        { src: 'modals', dest: '' }
      ]
    })
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        login: resolve(__dirname, 'login.html'),
        adminLogin: resolve(__dirname, 'admin-login.html'),
        obrigado: resolve(__dirname, 'obrigado.html')
      }
    }
  }
});
