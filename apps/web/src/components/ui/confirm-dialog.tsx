'use client';

import { useState, type ReactNode } from 'react';
import { Button } from './button';
import { Dialog } from './dialog';
import { FormField } from './form-field';
import { Textarea } from './textarea';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  /** Ask for a reason (e.g. block a stage, reject an expense). */
  reason?: { label: string; required?: boolean; placeholder?: string };
  onConfirm: (reason: string) => void;
}

/** Remounts per open so the reason field always starts empty. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  return <ConfirmDialogBody key={props.open ? 'open' : 'closed'} {...props} />;
}

function ConfirmDialogBody({ open, onOpenChange, title, description, confirmLabel = 'Confirm', destructive, loading, reason, onConfirm }: ConfirmDialogProps) {
  const [text, setText] = useState('');
  const invalid = reason?.required && text.trim().length === 0;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant={destructive ? 'destructive' : 'primary'} loading={loading} disabled={invalid} onClick={() => onConfirm(text.trim())}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {reason ? (
        <FormField label={reason.label} required={reason.required}>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={reason.placeholder} autoFocus />
        </FormField>
      ) : (
        <p className="text-sm text-muted-foreground">This action can&apos;t be undone.</p>
      )}
    </Dialog>
  );
}
