"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { FieldMessage } from "./form";

// A WYSIWYG editor for description fields. It sends its HTML with the form
// through a hidden input named `name`; the server cleans that HTML before
// saving (lib/rich-text.ts), so the editor is a convenience, not a gate.

export function RichTextField({
  label,
  name,
  defaultValue = "",
  hint,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
  error?: string;
}) {
  const [html, setHtml] = useState(defaultValue);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
    ],
    content: defaultValue,
    // Rendered on the server first; build the editor in the browser only.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rich-text min-h-32 px-3.5 py-2.5 outline-none",
        "aria-label": label,
      },
    },
    onUpdate: ({ editor }) => setHtml(editor.isEmpty ? "" : editor.getHTML()),
  });

  return (
    <div>
      <span className="text-sm font-semibold">{label}</span>
      <div
        aria-invalid={error ? true : undefined}
        className="mt-1.5 overflow-hidden rounded-xl border-2 border-border bg-surface transition focus-within:border-lime-ink focus-within:ring-4 focus-within:ring-lime/25 aria-invalid:border-danger"
      >
        {editor ? (
          <>
            <Toolbar editor={editor} />
            <EditorContent editor={editor} />
          </>
        ) : (
          <div className="min-h-32 px-3.5 pt-14 text-muted/70">Loading editor…</div>
        )}
      </div>
      <input type="hidden" name={name} value={html} />
      <FieldMessage hint={hint} error={error} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bullets: editor.isActive("bulletList"),
      numbers: editor.isActive("orderedList"),
      quote: editor.isActive("blockquote"),
      link: editor.isActive("link"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  function editLink() {
    const current = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address (leave empty to remove the link)", current ?? "https://");
    if (url === null) return;
    const chain = editor.chain().focus().extendMarkRange("link");
    if (url.trim() === "" || url.trim() === "https://") chain.unsetLink().run();
    else chain.setLink({ href: url.trim() }).run();
  }

  const run = (fn: (e: Editor) => void) => () => fn(editor);
  const buttons: { label: string; icon: React.ReactNode; active?: boolean; disabled?: boolean; onClick: () => void }[] = [
    { label: "Bold", icon: <b>B</b>, active: state.bold, onClick: run((e) => e.chain().focus().toggleBold().run()) },
    { label: "Italic", icon: <i className="font-serif">I</i>, active: state.italic, onClick: run((e) => e.chain().focus().toggleItalic().run()) },
    { label: "Underline", icon: <u>U</u>, active: state.underline, onClick: run((e) => e.chain().focus().toggleUnderline().run()) },
    { label: "Heading", icon: "H2", active: state.h2, onClick: run((e) => e.chain().focus().toggleHeading({ level: 2 }).run()) },
    { label: "Subheading", icon: "H3", active: state.h3, onClick: run((e) => e.chain().focus().toggleHeading({ level: 3 }).run()) },
    { label: "Bulleted list", icon: <ListIcon />, active: state.bullets, onClick: run((e) => e.chain().focus().toggleBulletList().run()) },
    { label: "Numbered list", icon: <NumberedIcon />, active: state.numbers, onClick: run((e) => e.chain().focus().toggleOrderedList().run()) },
    { label: "Quote", icon: <QuoteIcon />, active: state.quote, onClick: run((e) => e.chain().focus().toggleBlockquote().run()) },
    { label: "Link", icon: <LinkIcon />, active: state.link, onClick: editLink },
    { label: "Undo", icon: "↶", disabled: !state.canUndo, onClick: run((e) => e.chain().focus().undo().run()) },
    { label: "Redo", icon: "↷", disabled: !state.canRedo, onClick: run((e) => e.chain().focus().redo().run()) },
  ];

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-0.5 border-b-2 border-border bg-background/60 p-1.5">
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          title={b.label}
          aria-label={b.label}
          aria-pressed={b.active ?? undefined}
          disabled={b.disabled}
          onClick={b.onClick}
          className={`grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-sm font-semibold transition disabled:opacity-35 ${
            b.active ? "bg-lime text-brand-deep" : "hover:bg-border"
          }`}
        >
          {b.icon}
        </button>
      ))}
    </div>
  );
}

const svg = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const ListIcon = () => (
  <svg {...svg}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4" cy="6" r="1" fill="currentColor" />
    <circle cx="4" cy="12" r="1" fill="currentColor" />
    <circle cx="4" cy="18" r="1" fill="currentColor" />
  </svg>
);

const NumberedIcon = () => (
  <svg {...svg}>
    <path d="M10 6h10M10 12h10M10 18h10M4 5l1-1v4M3.5 14h2l-2 3h2" />
  </svg>
);

const QuoteIcon = () => (
  <svg {...svg}>
    <path d="M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6" />
  </svg>
);

const LinkIcon = () => (
  <svg {...svg}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);
