import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "electrobun-pdf",
		identifier: "electrobunpdf.local.app",
		version: "1.0.0",
	},
	build: {
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
			"node_modules/mupdf/dist/mupdf-wasm.wasm": "bun/mupdf-wasm.wasm",
		},
		watchIgnore: ["dist/**"],
		mac: {
			bundleCEF: false,
		},
		linux: {
			bundleCEF: false,
		},
		win: {
			bundleCEF: false,
		},
	},
} satisfies ElectrobunConfig;
