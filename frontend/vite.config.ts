import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		port: 5173,
		proxy: {
			"/trpc": {
				target: "http://localhost:3001",
				changeOrigin: true,
			},
		},
	},
});
