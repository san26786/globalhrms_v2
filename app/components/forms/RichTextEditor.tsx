"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Code, Heading2, Italic, List, ListOrdered, Redo, Underline, Undo, AlignLeft, AlignCenter, AlignRight } from "lucide-react";

const TOOLS: Array<{ title: string; icon: typeof Bold; command: string; arg?: string }> = [
  { title: "Bold", icon: Bold, command: "bold" },
  { title: "Italic", icon: Italic, command: "italic" },
  { title: "Underline", icon: Underline, command: "underline" },
  { title: "Heading", icon: Heading2, command: "formatBlock", arg: "h2" },
  { title: "Bulleted list", icon: List, command: "insertUnorderedList" },
  { title: "Numbered list", icon: ListOrdered, command: "insertOrderedList" },
  { title: "Align left", icon: AlignLeft, command: "justifyLeft" },
  { title: "Align center", icon: AlignCenter, command: "justifyCenter" },
  { title: "Align right", icon: AlignRight, command: "justifyRight" },
  { title: "Undo", icon: Undo, command: "undo" },
  { title: "Redo", icon: Redo, command: "redo" },
];

/**
 * Small rich-text (HTML) editor without extra dependencies — the role CKEditor 4 played in CI
 * (document templates): bold / italic / underline, heading, lists, alignment, undo / redo and an
 * HTML source view. The server sanitises what is saved (lib/systmMngt/shared.sanitizeHtml).
 *
 * It uses the browser's editing commands (document.execCommand): deprecated but supported by every
 * current browser, and enough for template bodies.
 */
export default function RichTextEditor({
  value,
  onChange,
  disabled,
  id,
  minHeight = 320,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  id?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState(false);

  // Push external value changes (initial load, source view edits) into the editable area.
  useEffect(() => {
    const el = ref.current;
    if (el && !source && el.innerHTML !== value) el.innerHTML = value;
  }, [value, source]);

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-1" role="toolbar" aria-label="Formatting">
        {TOOLS.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            aria-label={t.title}
            disabled={disabled || source}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(t.command, t.arg)}
            className="rounded p-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
          >
            <t.icon className="h-4 w-4" />
          </button>
        ))}
        <button
          type="button"
          title="HTML source"
          aria-pressed={source}
          disabled={disabled}
          onClick={() => setSource((s) => !s)}
          className={`ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${source ? "bg-slate-700 text-white" : "text-slate-600 hover:bg-slate-200"}`}
        >
          <Code className="h-4 w-4" /> Source
        </button>
      </div>
      {source ? (
        <textarea
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="block w-full resize-y p-3 font-mono text-xs text-slate-800 focus:outline-none"
          style={{ minHeight }}
        />
      ) : (
        <div
          id={id}
          ref={ref}
          role="textbox"
          aria-multiline="true"
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
          className="prose prose-sm max-w-none p-3 text-sm text-slate-800 focus:outline-none"
          style={{ minHeight }}
        />
      )}
    </div>
  );
}
