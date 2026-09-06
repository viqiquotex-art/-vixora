import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // VIXORA is served from the root of vixora.my.id.
  // Use absolute asset URLs so GitHub Pages + custom domain always resolve bundles correctly.
  base: '/',
})
