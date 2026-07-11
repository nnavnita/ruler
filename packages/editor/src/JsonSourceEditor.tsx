import { useEffect, useState } from "react";
import type { JdmContent } from "./types";

export interface JsonSourceEditorProps {
  /** Current graph — will be stringified into the editor. */
  value: JdmContent;
  /** Called when the user's edited source parses cleanly. */
  onChange: (next: JdmContent) => void;
  className?: string;
  /** Title shown in the header strip. Defaults to "JDM source". */
  title?: string;
}

/**
 * Raw JDM JSON editor. Two-way bound with the visual editor via `value` +
 * `onChange`. While the buffer is unparseable we do NOT push anything up,
 * so mid-typing states can't corrupt the visual graph.
 *
 * Respects `prefers-color-scheme: dark`.
 */
export function JsonSourceEditor(props: JsonSourceEditorProps) {
  const { value, onChange, className, title = "JDM source" } = props;
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  // If an outside update (e.g. AI generation) changes `value`, reset the
  // buffer — but only if the current buffer is either unparseable or
  // logically equal to the new value; never clobber in-progress edits.
  useEffect(() => {
    try {
      const parsed = JSON.parse(text);
      if (JSON.stringify(parsed) === JSON.stringify(value)) return;
    } catch {
      return;
    }
    setText(JSON.stringify(value, null, 2));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (next: string) => {
    setText(next);
    try {
      const parsed = JSON.parse(next) as JdmContent;
      setError(null);
      onChange(parsed);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(text);
      setText(JSON.stringify(parsed, null, 2));
      setError(null);
      onChange(parsed);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    }
  };

  return (
    <div
      className={
        "flex flex-col border border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 " +
        (className ?? "")
      }
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </div>
        <div className="flex items-center gap-2">
          {error ? (
            <span className="max-w-xs truncate rounded bg-red-100 px-2 py-0.5 text-[11px] text-red-800 dark:bg-red-900/40 dark:text-red-200" title={error}>
              {error}
            </span>
          ) : (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              parseable
            </span>
          )}
          <button
            type="button"
            onClick={handleFormat}
            className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Format
          </button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        wrap="off"
        className={
          "flex-1 resize-none bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100 focus:outline-none " +
          (error ? "ring-2 ring-red-500" : "")
        }
      />
    </div>
  );
}
