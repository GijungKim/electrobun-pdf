interface StatusBarProps {
	fileName: string | null;
	status: string;
	wordCount: number;
	currentPage?: number;
	pageCount?: number;
}

export default function StatusBar({
	fileName,
	status,
	wordCount,
	currentPage,
	pageCount = 0,
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
			{pageCount > 0 ? (
				<span>
					Page {currentPage} of {pageCount}
				</span>
			) : (
				wordCount > 0 && <span>{wordCount.toLocaleString()} words</span>
			)}
		</div>
	);
}
