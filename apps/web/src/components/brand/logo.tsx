import Link from 'next/link';
import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-primary dark:fill-blue-600" />
      <circle cx="16" cy="13" r="5" fill="#fbbf24" />
      <g stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round">
        <path d="M16 4.5v2M16 19.5v2M7.5 13h2M22.5 13h2M10 7l1.4 1.4M20.6 17.6 22 19M22 7l-1.4 1.4M11.4 17.6 10 19" />
      </g>
      <path d="M7 27l3-5h12l3 5z" fill="#93c5fd" />
    </svg>
  );
}

export function Logo({ href = '/', className, compact }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn('inline-flex items-center gap-2 rounded-md font-semibold tracking-tight', className)} aria-label="SolarFlow home">
      <LogoMark />
      {!compact && (
        <span className="text-[17px]">
          Solar<span className="text-amber-500">Flow</span>
        </span>
      )}
    </Link>
  );
}
