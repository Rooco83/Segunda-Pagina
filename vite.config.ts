import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// SINGLEFILE=1 produce un único index.html autocontenido (para previews/artifacts).
const singleFile = process.env.SINGLEFILE === '1'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
})
