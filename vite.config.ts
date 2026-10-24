import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        watch: {
            ignored: ['**/.vs/**'],   // Visual Studio's own folder: locked while VS is open
        },
    },
})