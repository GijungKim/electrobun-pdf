interface StatusBarProps {
	fileName: string | null;
	status: string;
	wordCount: number;
}

export default function StatusBar({
	fileName,
	status,
	wordCount,
}: StatusBarProps) {
	return (
		<div className="flex items-center justify-between px-4 py-1 bg-surface-900 border-t border-surface-800 text-[11px] font-mono text-surface-500 select-none">
			<div className="flex items-center gap-2.5">
				<span className="text-surface-400">{fileName || "No file"}</span>
				{status && (
					<>
						<span className="text-surface-700">/</span>
						<span>{status}</span>
					</>
				)}
			</div>
			{wordCount > 0 && (
				<span>{wordCount.toLocaleString()} words</span>
			)}
		</div>
	);
}
