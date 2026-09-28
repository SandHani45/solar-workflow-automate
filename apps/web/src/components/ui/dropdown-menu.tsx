'use client';

import * as Menu from '@radix-ui/react-dropdown-menu';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;

export const DropdownMenuContent = forwardRef<ElementRef<typeof Menu.Content>, ComponentPropsWithoutRef<typeof Menu.Content>>(function DropdownMenuContent(
  { className, sideOffset = 6, align = 'end', ...props },
  ref,
) {
  return (
    <Menu.Portal>
      <Menu.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 min-w-44 overflow-hidden rounded-xl border border-border bg-popover p-1 text-sm shadow-lg data-[state=open]:animate-zoom-in',
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
});

export const DropdownMenuItem = forwardRef<ElementRef<typeof Menu.Item>, ComponentPropsWithoutRef<typeof Menu.Item> & { destructive?: boolean }>(function DropdownMenuItem(
  { className, destructive, ...props },
  ref,
) {
  return (
    <Menu.Item
      ref={ref}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 outline-none select-none [&_svg]:size-4 [&_svg]:text-muted-foreground',
        'data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        destructive && 'text-destructive [&_svg]:text-destructive',
        className,
      )}
      {...props}
    />
  );
});

export function DropdownMenuLabel({ className, ...props }: ComponentPropsWithoutRef<typeof Menu.Label>) {
  return <Menu.Label className={cn('px-2.5 py-1.5 text-xs font-medium text-muted-foreground', className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentPropsWithoutRef<typeof Menu.Separator>) {
  return <Menu.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}
