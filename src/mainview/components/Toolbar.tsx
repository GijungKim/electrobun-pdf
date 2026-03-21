import { Editor } from "@tiptap/react";
import {
	Bold,
	Italic,
	Underline,
	Strikethrough,
	AlignLeft,
	AlignCenter,
	AlignRight,
	AlignJustify,
	List,
	ListOrdered,
	Quote,
	Redo,
	Undo,
	Heading1,
	Heading2,
	Heading3,
	Table,
	Highlighter,
	FileDown,
	FolderOpen,
	Minus,
} from "lucide-react";

interface ToolbarProps {
	editor: Editor | null;
	onOpen: () => void;
	onExportPdf: () => void;
}

function Btn({
	onClick,
	isActive = false,
	disabled = false,
	title,
	children,
}: {
	onClick: () => void;
	isActive?: boolean;
	disabled?: boolean;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			title={title}
			className={`toolbar-btn ${isActive ? "active" : "text-surface-400 hover:text-surface-200"} ${disabled ? "" : "cursor-pointer"}`}
		>
			{children}
		</button>
	);
}

function Divider() {
	return <div className="w-px h-5 bg-surface-700 mx-1.5" />;
}

export default function Toolbar({ editor, onOpen, onExportPdf }: ToolbarProps) {
	if (!editor) return null;

	return (
		<div className="flex items-center gap-0.5 px-3 py-1.5 bg-surface-900 border-b border-surface-800 flex-wrap">
			<Btn onClick={onOpen} title="Open file">
				<FolderOpen size={16} />
			</Btn>
			<Btn onClick={onExportPdf} title="Export as PDF">
				<FileDown size={16} />
			</Btn>

			<Divider />

			<Btn
				onClick={() => editor.chain().focus().undo().run()}
				disabled={!editor.can().undo()}
				title="Undo"
			>
				<Undo size={16} />
			</Btn>
			<Btn
				onClick={() => editor.chain().focus().redo().run()}
				disabled={!editor.can().redo()}
				title="Redo"
			>
				<Redo size={16} />
			</Btn>

			<Divider />

			<Btn
				onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
				isActive={editor.isActive("heading", { level: 1 })}
				title="Heading 1"
			>
				<Heading1 size={16} />
			</Btn>
			<Btn
				onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
				isActive={editor.isActive("heading", { level: 2 })}
				title="Heading 2"
			>
				<Heading2 size={16} />
			</Btn>
			<Btn
				onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
				isActive={editor.isActive("heading", { level: 3 })}
				title="Heading 3"
			>
				<Heading3 size={16} />
			</Btn>

			<Divider />

			<Btn
				onClick={() => editor.chain().focus().toggleBold().run()}
				isActive={editor.isActive("bold")}
				title="Bold"
			>
				<Bold size={16} />
			</Btn>
			<Btn
				onClick={() => editor.chain().focus().toggleItalic().run()}
				isActive={editor.isActive("italic")}
				title="Italic"
			>
				<Italic size={16} />
			</Btn>
			<Btn
				onClick={() => editor.chain().focus().toggleUnderline().run()}
				isActive={editor.isActive("underline")}
				title="Underline"
			>
				<Underline size={16} />
			</Btn>
			<Btn
				onClick={() => editor.chain().focus().toggleStrike().run()}
				isActive={editor.isActive("strike")}
				title="Strikethrough"
			>
				<Strikethrough size={16} />
			</Btn>
			<Btn
				onClick={() => editor.chain().focus().toggleHighlight().run()}
				isActive={editor.isActive("highlight")}
				title="Highlight"
			>
				<Highlighter size={16} />
			</Btn>

			<Divider />

			<Btn
				onClick={() => editor.chain().focus().setTextAlign("left").run()}
				isActive={editor.isActive({ textAlign: "left" })}
				title="Align left"
			>
				<AlignLeft size={16} />
			</Btn>
			<Btn
				onClick={() => editor.chain().focus().setTextAlign("center").run()}
				isActive={editor.isActive({ textAlign: "center" })}
				title="Align center"
			>
				<AlignCenter size={16} />
			</Btn>
			<Btn
				onClick={() => editor.chain().focus().setTextAlign("right").run()}
				isActive={editor.isActive({ textAlign: "right" })}
				title="Align right"
			>
				<AlignRight size={16} />
			</Btn>
			<Btn
				onClick={() => editor.chain().focus().setTextAlign("justify").run()}
				isActive={editor.isActive({ textAlign: "justify" })}
				title="Justify"
			>
				<AlignJustify size={16} />
			</Btn>

			<Divider />

			<Btn
				onClick={() => editor.chain().focus().toggleBulletList().run()}
				isActive={editor.isActive("bulletList")}
				title="Bullet list"
			>
				<List size={16} />
			</Btn>
			<Btn
				onClick={() => editor.chain().focus().toggleOrderedList().run()}
				isActive={editor.isActive("orderedList")}
				title="Numbered list"
			>
				<ListOrdered size={16} />
			</Btn>

			<Divider />

			<Btn
				onClick={() => editor.chain().focus().toggleBlockquote().run()}
				isActive={editor.isActive("blockquote")}
				title="Quote"
			>
				<Quote size={16} />
			</Btn>
			<Btn
				onClick={() => editor.chain().focus().setHorizontalRule().run()}
				title="Horizontal rule"
			>
				<Minus size={16} />
			</Btn>
			<Btn
				onClick={() =>
					editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
				}
				title="Insert table"
			>
				<Table size={16} />
			</Btn>
		</div>
	);
}
