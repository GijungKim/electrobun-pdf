/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/mainview/**/*.{html,js,ts,jsx,tsx}"],
	theme: {
		extend: {
			fontFamily: {
				sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
				mono: ["ui-monospace", "SFMono-Regular", "SF Mono", "Menlo", "Consolas", "Liberation Mono", "monospace"],
			},
			colors: {
				surface: {
					50: "#fafaf8",
					100: "#f3f2ee",
					200: "#e8e6e0",
					300: "#d4d1c8",
					400: "#a8a498",
					500: "#8a8678",
					600: "#6b675c",
					700: "#4a473f",
					800: "#2a2824",
					900: "#1a1916",
					950: "#0f0e0d",
				},
				accent: {
					DEFAULT: "#e67e22",
					50: "#fef6eb",
					100: "#fde8cc",
					200: "#fbd099",
					300: "#f5a623",
					400: "#e67e22",
					500: "#d35400",
					600: "#b34700",
					700: "#8a3700",
				},
			},
		},
	},
	plugins: [require("@tailwindcss/typography")],
};
