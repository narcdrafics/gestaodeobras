import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
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
