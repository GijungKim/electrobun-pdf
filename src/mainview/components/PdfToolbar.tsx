import {
	MousePointer2,
	Type,
	Circle,
	FolderOpen,
	FileDown,
	Minus,
	Plus,
} from "lucide-react";
import type { Tool } from "./PdfAnnotationLayer";

interface PdfToolbarProps {
	activeTool: Tool;
	onToolChange: (tool: Tool) => void;
	strokeWidth: number;
	onStrokeWidthChange: (w: number) => void;
	color: string;
	onColorChange: (c: string) => void;
	onOpen: () => void;
	onExportPdf: () => void;
}

const PRESET_COLORS = [
	"#1a1916",
	"#c0392b",
	"#e67e22",
	"#2980b9",
	"#27ae60",
	"#8e44ad",
];

function isDark(hex: string): boolean {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return (r * 299 + g * 587 + b * 114) / 1000 < 80;
}

function Btn({
	onClick,
	isActive = false,
	title,
	children,
}: {
	onClick: () => void;
	isActive?: boolean;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			title={title}
			aria-label={title}
			className={`toolbar-btn ${isActive ? "active" : "text-surface-400 hover:text-surface-200"} cursor-pointer`}
		>
			{children}
		</button>
	);
}

function Divider() {
	return <div className="w-px h-5 bg-surface-700 mx-1.5" />;
}

export default function PdfToolbar({
	activeTool,
	onToolChange,
	strokeWidth,
	onStrokeWidthChange,
	color,
	onColorChange,
	onOpen,
	onExportPdf,
}: PdfToolbarProps) {
	return (
		<div className="flex items-center gap-0.5 px-3 py-1.5 bg-surface-900 border-b border-surface-800">
			<Btn onClick={onOpen} title="Open file">
				<FolderOpen size={16} />
			</Btn>
			<Btn onClick={onExportPdf} title="Export as PDF">
				<FileDown size={16} />
			</Btn>

			<Divider />

			<Btn
				onClick={() => onToolChange("select")}
				isActive={activeTool === "select"}
				title="Select (V)"
			>
				<MousePointer2 size={16} />
			</Btn>
			<Btn
				onClick={() => onToolChange("text")}
				isActive={activeTool === "text"}
				title="Add text (T)"
			>
				<Type size={16} />
			</Btn>
			<Btn
				onClick={() => onToolChange("circle")}
				isActive={activeTool === "circle"}
				title="Draw circle / oval (C)"
			>
				<Circle size={16} />
			</Btn>

			<Divider />

			{/* Color swatches */}
			<div className="flex items-center gap-1 px-0.5">
				{PRESET_COLORS.map((c) => (
					<button
						key={c}
						type="button"
						onClick={() => onColorChange(c)}
						title={c}
						aria-label={`Annotation color ${c}`}
						className={`w-4 h-4 rounded-full cursor-pointer transition-all duration-150 ${
							color === c
								? "ring-1.5 ring-accent ring-offset-1 ring-offset-surface-900 scale-110"
								: "hover:scale-125 opacity-80 hover:opacity-100"
						} ${isDark(c) ? "border border-surface-500" : ""}`}
						style={{ backgroundColor: c }}
					/>
				))}
				<label
					className="relative cursor-pointer ml-0.5"
					title="Custom color"
				>
					<input
						type="color"
						value={color}
						onChange={(e) => onColorChange(e.target.value)}
						aria-label="Custom annotation color"
						className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
					/>
					<div
						className="w-4 h-4 rounded-full border border-surface-600"
						style={{
							background:
								"conic-gradient(#c0392b, #e67e22, #27ae60, #2980b9, #8e44ad, #c0392b)",
						}}
					/>
				</label>
			</div>

			<Divider />

			{/* Stroke width */}
			<div className="flex items-center gap-0.5 text-surface-400">
				<button
					type="button"
					onClick={() =>
						onStrokeWidthChange(Math.max(1, strokeWidth - 1))
					}
					className="p-1 rounded hover:bg-white/10 cursor-pointer transition-colors"
					title="Decrease stroke"
					aria-label="Decrease stroke width"
				>
					<Minus size={12} />
				</button>
				<div
					className="flex items-center gap-1.5 min-w-[48px] justify-center"
					title="Stroke width"
				>
					<div
						className={`rounded-full transition-all duration-150 ${isDark(color) ? "ring-1 ring-surface-500" : ""}`}
						style={{
							width: Math.max(4, Math.min(strokeWidth * 2, 16)),
							height: Math.max(4, Math.min(strokeWidth * 2, 16)),
							backgroundColor: color,
						}}
					/>
					<span className="text-[10px] font-mono text-surface-500 tabular-nums">
						{strokeWidth}
					</span>
				</div>
				<button
					type="button"
					onClick={() =>
						onStrokeWidthChange(Math.min(12, strokeWidth + 1))
					}
					className="p-1 rounded hover:bg-white/10 cursor-pointer transition-colors"
					title="Increase stroke"
					aria-label="Increase stroke width"
				>
					<Plus size={12} />
				</button>
			</div>
		</div>
	);
}
