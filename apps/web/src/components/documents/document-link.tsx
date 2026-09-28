import { FileImage, FileText } from 'lucide-react';
import type { ProjectDocument } from '@/lib/types';
import { cn, formatBytes } from '@/lib/utils';

/** Opens the API download URL (same-origin, cookie-authenticated) in a new tab. */
export function DocumentLink({ doc, className }: { doc: ProjectDocument; className?: string }) {
  const Icon = doc.mimeType.startsWith('image/') ? FileImage : FileText;
  return (
    <a href={doc.url} target="_blank" rel="noreferrer" className={cn('inline-flex max-w-full items-center gap-1.5 text-xs text-primary hover:underline dark:text-blue-400', className)} title={`${doc.originalName} · ${formatBytes(doc.size)}`}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{doc.originalName}</span>
    </a>
  );
}
