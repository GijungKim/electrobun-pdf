import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
	children: ReactNode;
}

interface ErrorBoundaryState {
	error: Error | null;
}

/**
 * Catches render-time errors in the React tree below it and shows a recoverable
 * fallback instead of a blank window. Must be a class component — React has no
 * hook equivalent for error boundaries.
 */
export default class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	state: ErrorBoundaryState = { error: null };

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("Unhandled UI error:", error, info.componentStack);
	}

	private handleReload = () => {
		window.location.reload();
	};

	render() {
		if (this.state.error) {
			return (
				<div className="h-screen flex flex-col items-center justify-center bg-surface-950 text-surface-200 px-8 text-center">
					<AlertTriangle
						size={40}
						className="text-accent mb-5"
						strokeWidth={1.75}
					/>
					<h1 className="text-lg font-mono font-semibold text-surface-100">
						Something went wrong
					</h1>
					<p className="mt-2 max-w-md text-sm text-surface-400 leading-relaxed">
						The editor hit an unexpected error. Any unsaved changes in
						this session may be lost. Reloading starts a fresh window.
					</p>
					<button
						type="button"
						onClick={this.handleReload}
						className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg font-medium transition-all duration-200 hover:bg-accent-500 active:scale-[0.98]"
					>
						<RotateCcw size={16} strokeWidth={2} />
						<span>Reload</span>
					</button>
				</div>
			);
		}
		return this.props.children;
	}
}
