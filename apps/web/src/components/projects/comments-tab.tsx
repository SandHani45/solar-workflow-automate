'use client';

import { MessageSquare, Send } from 'lucide-react';
import { useState } from 'react';
import { useAddComment, useProjectComments } from '@/hooks/api/use-projects';
import { formatRelative } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { SkeletonText } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

/** Threaded-style comment list with composer; also used for ticket comments via props. */
export function CommentThread({
  comments,
  loading,
  error,
  onPost,
  posting,
  placeholder = 'Write a comment…',
}: {
  comments: { id: string; body: string; by: { name: string }; at?: string; createdAt?: string }[] | undefined;
  loading?: boolean;
  error?: unknown;
  onPost: (body: string, done: () => void) => void;
  posting?: boolean;
  placeholder?: string;
}) {
  const [body, setBody] = useState('');
  return (
    <div className="space-y-4">
      {loading && <SkeletonText lines={4} />}
      {error != null && <ErrorState error={error} />}
      {!loading && comments?.length === 0 && <EmptyState compact icon={MessageSquare} title="No comments yet" description="Discuss the project with your team here." />}
      <ul className="space-y-3">
        {comments?.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar name={c.by?.name ?? '?'} />
            <div className="min-w-0 flex-1 rounded-xl bg-muted/50 px-3 py-2">
              <p className="text-xs">
                <span className="font-semibold">{c.by?.name}</span> <span className="text-muted-foreground">· {formatRelative(c.at ?? c.createdAt)}</span>
              </p>
              <p className="mt-0.5 text-sm whitespace-pre-line">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) onPost(body.trim(), () => setBody(''));
        }}
        className="flex items-end gap-2"
      >
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} rows={2} aria-label="Comment" className="flex-1" />
        <Button type="submit" size="icon" loading={posting} disabled={!body.trim()} aria-label="Post comment">
          {!posting && <Send />}
        </Button>
      </form>
    </div>
  );
}

export function CommentsTab({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useProjectComments(projectId);
  const add = useAddComment(projectId);
  return (
    <Card className="p-4 sm:p-5">
      <CommentThread comments={data} loading={isLoading} error={error} posting={add.isPending} onPost={(b, done) => add.mutate(b, { onSuccess: done })} />
    </Card>
  );
}
