'use client';

import { CheckCircle2, CloudUpload, Loader2, Upload, XCircle } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';
import { errorMessage } from '@/lib/api-client';
import { cn, formatBytes } from '@/lib/utils';

export const DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';
const ACCEPTED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

interface UploadItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

interface FileUploadProps {
  /** Upload one file; report 0-100 progress. Rejections are shown inline. */
  onUpload: (file: File, onProgress: (pct: number) => void) => Promise<unknown>;
  accept?: string;
  multiple?: boolean;
  maxSizeMb?: number;
  label?: string;
  hint?: string;
  /** Small inline button instead of a drop zone (per-document-type rows). */
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({
  onUpload,
  accept = DOCUMENT_ACCEPT,
  multiple = true,
  maxSizeMb = 15,
  label = 'Drop files here or click to browse',
  hint = 'PDF, JPG, PNG, WEBP or HEIC · up to 15 MB',
  compact,
  disabled,
  className,
}: FileUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);

  const patch = (id: string, p: Partial<UploadItem>) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));

  const start = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const tooBig = file.size > maxSizeMb * 1024 * 1024;
      const badType = accept === DOCUMENT_ACCEPT && !ACCEPTED_EXT.includes(ext);
      const error = tooBig ? `Larger than ${maxSizeMb} MB` : badType ? 'Unsupported file type' : undefined;
      setItems((prev) => [...prev, { id, name: file.name, size: file.size, progress: 0, status: error ? 'error' : 'uploading', error }]);
      if (error) continue;
      onUpload(file, (pct) => patch(id, { progress: pct }))
        .then(() => {
          patch(id, { status: 'done', progress: 100 });
          setTimeout(() => setItems((prev) => prev.filter((it) => it.id !== id)), 2000);
        })
        .catch((err: unknown) => patch(id, { status: 'error', error: errorMessage(err) }));
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled && e.dataTransfer.files.length) start(e.dataTransfer.files);
  };

  const input = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      className="sr-only"
      accept={accept}
      multiple={multiple}
      disabled={disabled}
      onChange={(e) => {
        if (e.target.files?.length) start(e.target.files);
        e.target.value = '';
      }}
    />
  );

  const list = items.length > 0 && (
    <ul className="mt-2 space-y-1.5" aria-live="polite">
      {items.map((it) => (
        <li key={it.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs">
          {it.status === 'uploading' && <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden />}
          {it.status === 'done' && <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-hidden />}
          {it.status === 'error' && <XCircle className="size-3.5 shrink-0 text-destructive" aria-hidden />}
          <span className="min-w-0 flex-1 truncate">{it.name}</span>
          {it.status === 'uploading' && (
            <span className="flex w-20 items-center gap-1.5">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <span className="block h-full bg-primary transition-[width] dark:bg-blue-500" style={{ width: `${it.progress}%` }} />
              </span>
              <span className="tabular w-7 text-right text-muted-foreground">{it.progress}%</span>
            </span>
          )}
          {it.status === 'error' && (
            <span className="max-w-[45%] truncate text-destructive" title={it.error}>
              {it.error}
            </span>
          )}
          {it.status !== 'uploading' && (
            <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={`Dismiss ${it.name}`} onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}>
              <XCircle className="size-3.5" />
            </button>
          )}
          <span className="sr-only">{formatBytes(it.size)}</span>
        </li>
      ))}
    </ul>
  );

  if (compact) {
    return (
      <div className={className}>
        {input}
        <label
          htmlFor={inputId}
          className={cn(
            'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-input px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary',
            'focus-within:outline-2 focus-within:outline-ring',
            disabled && 'pointer-events-none opacity-50',
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <Upload className="size-3.5" aria-hidden />
          {label}
        </label>
        {list}
      </div>
    );
  }

  return (
    <div className={className}>
      {input}
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-muted/20 px-4 py-6 text-center transition-colors',
          'hover:border-primary/60 hover:bg-primary-soft focus-within:outline-2 focus-within:outline-ring',
          dragging && 'border-primary bg-primary-soft',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <CloudUpload className="size-7 text-primary dark:text-blue-400" aria-hidden />
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </label>
      {list}
    </div>
  );
}
