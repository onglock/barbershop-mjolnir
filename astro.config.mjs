// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  /* Site нужен для абсолютных ссылок (canonical, og:url, карта сайта).
     Адрес проекта на Vercel — заглушка до выбора своего домена. */
  site: 'https://barbershop-mjolnir.vercel.app',

  /* Дев-панель Astro висела внизу каждой страницы и перекрывала контент
     (жалоба Кирилла 2026-09-24). Выключена целиком: на превью-страницах она
     мешала больше всего, а больше нигде не нужна. */
  devToolbar: { enabled: false },

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [react()]
});