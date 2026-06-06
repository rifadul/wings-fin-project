import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-server port comes from FRONTEND_PORT (.env / docker-compose); 5173 fallback.
const port = Number(process.env.FRONTEND_PORT) || 5173;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0 so the container port is reachable
    port,
  },
});
