import { FolderOpen, Lock, Zap, FileText } from "lucide-react";

interface WelcomeScreenProps {
	onOpen: () => void;
	status?: string;
}

export default function WelcomeScreen({ onOpen, status }: WelcomeScreenProps) {
	return (
		<div className="h-full flex flex-col items-center justify-center bg-surface-950 noise-bg overflow-hidden relative">
			<div className="relative z-10 flex flex-col items-center">
				{/* Brand mark */}
				<div className="mb-10 flex items-center gap-3">
					<div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
						<FileText size={22} className="text-white" strokeWidth={2.5} />
					</div>
					<h1 className="text-2xl font-mono font-semibold text-surface-100 tracking-tight">
						electrobun-pdf
					</h1>
				</div>

				{/* Tagline */}
				<p className="text-surface-400 text-center max-w-sm mb-10 leading-relaxed font-light">
					Open, annotate, and export documents.
					<br />
					<span className="text-surface-500">Nothing leaves your machine.</span>
				</p>

				{/* CTA */}
				<button
					type="button"
					onClick={onOpen}
					className="group flex items-center gap-2.5 px-7 py-3 bg-accent text-white rounded-lg font-medium tracking-wide transition-all duration-200 hover:bg-accent-500 hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98]"
				>
					<FolderOpen size={18} strokeWidth={2} />
					<span>Open Document</span>
				</button>

				<p
					className={`mt-3 text-xs ${status ? "text-accent-300" : "text-surface-600"}`}
				>
					{status || "PDF, DOCX — or drop a file anywhere"}
				</p>

				{/* Feature pills */}
				<div className="mt-14 flex items-center gap-6 text-xs text-surface-500">
					<div className="flex items-center gap-1.5">
						<Lock size={12} strokeWidth={2.5} className="text-surface-600" />
						<span>Local-first</span>
					</div>
					<div className="w-px h-3 bg-surface-800" />
					<div className="flex items-center gap-1.5">
						<Zap size={12} strokeWidth={2.5} className="text-surface-600" />
						<span>Lightweight</span>
					</div>
					<div className="w-px h-3 bg-surface-800" />
					<div className="flex items-center gap-1.5">
						<span className="font-mono text-surface-600">OSS</span>
						<span>Open source</span>
					</div>
				</div>
			</div>

			{/* Subtle radial glow */}
			<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/[0.03] blur-3xl pointer-events-none" />
		</div>
	);
}
