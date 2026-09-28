'use client';

import Link from 'next/link';
import { Bell, KeyRound, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useLogout, useSession } from '@/hooks/use-session';
import { useTheme } from '@/providers/theme-provider';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export function UserMenu() {
  const session = useSession();
  const logout = useLogout();
  const { setPreference, preference } = useTheme();
  const { user, role, org } = session;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-0.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" aria-label="Account menu">
        <Avatar name={user.name} src={user.avatarUrl} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {user.isSuperAdmin ? 'Platform super admin' : role?.name}
            {org ? ` · ${org.name}` : ''}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <KeyRound /> Profile & password
          </Link>
        </DropdownMenuItem>
        {session.features.notifications && (
          <DropdownMenuItem asChild>
            <Link href="/notifications">
              <Bell /> Notifications
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <div className="grid grid-cols-3 gap-1 px-1 pb-1">
          {(
            [
              ['light', Sun, 'Light'],
              ['dark', Moon, 'Dark'],
              ['system', Monitor, 'Auto'],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPreference(value)}
              aria-pressed={preference === value}
              className="flex flex-col items-center gap-1 rounded-md py-1.5 text-[11px] text-muted-foreground hover:bg-muted aria-pressed:bg-muted aria-pressed:text-foreground"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate()} destructive>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
