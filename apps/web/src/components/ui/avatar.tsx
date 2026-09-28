import { cn, initials } from '@/lib/utils';

const PALETTE = ['bg-blue-600', 'bg-amber-500', 'bg-emerald-600', 'bg-violet-600', 'bg-teal-600', 'bg-rose-600', 'bg-sky-600', 'bg-orange-500'];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length] ?? 'bg-blue-600';
}

const SIZES = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-9 text-sm', lg: 'size-12 text-base' } as const;

export function Avatar({ name, src, size = 'sm', className }: { name: string; src?: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ring-2 ring-card', SIZES[size], !src && colorFor(name), className)}
      title={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-supplied avatar URLs from any host
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      {!src && <span className="sr-only">{name}</span>}
    </span>
  );
}

export function AvatarGroup({ people, max = 4, size = 'sm' }: { people: { name: string; id?: string }[]; max?: number; size?: keyof typeof SIZES }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((p, i) => (
        <Avatar key={p.id ?? `${p.name}-${i}`} name={p.name} size={size} />
      ))}
      {rest > 0 && <span className={cn('inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-card', SIZES[size])}>+{rest}</span>}
    </div>
  );
}
