# Plan 004 — DOCX export findings & recommendation

## Approach chosen
Deterministic mapping from the editor's ProseMirror JSON (`editor.getJSON()`)
to styled jsPDF text via `src/mainview/utils/docExport.ts`. Chosen over a
canvas/`jsPDF.html()` path because Electrobun exposes no native print-to-PDF and
the repo already records that html2canvas was unreliable in this webview
(see the `exportToPdf` doc comment in `fileHandlers.ts`).

## What this increment covers
- Headings (h1–h3 sized, bold), paragraphs, blockquotes (as paragraphs)
- Bullet and numbered lists (prefix + indent)
- Whole-block bold / italic
- All text preserved (unknown node types degrade to plain text, never dropped)

## Deferred (recommended follow-ups, in rough priority order)
- Inline mid-paragraph marks (bold/italic changing within one line) — needs
  per-segment x-advance via `pdf.getTextWidth`, not block-level styling.
- Tables (`table` node) — currently flattened to text.
- Images (`image` node) — currently dropped; would need base64 → `pdf.addImage`.
- Underline, highlight background, text color, text alignment, nested lists.

## Verification performed
- [x] `bun test` exit 0, mapper tests pass
- [x] `bun run typecheck` exit 0
- [x] `bunx vite build` exit 0
- [ ] Manually exported a DOCX with headings + a bullet list + bold text and
      confirmed structure is preserved in the output PDF (not performed — GUI
      unavailable in headless executor environment).
