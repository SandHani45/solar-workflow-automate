import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

const COLUMNS = [
  { title: 'Product', links: [['Workflow', '/#workflow'], ['Features', '/#features'], ['Pricing', '/pricing'], ['Customer portal', '/#roles']] },
  { title: 'Company', links: [['About', '/#faq'], ['Contact sales', '/pricing#contact'], ['Careers', '/#faq']] },
  { title: 'Account', links: [['Sign in', '/login'], ['Create organisation', '/register'], ['Reset password', '/forgot-password']] },
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-3 text-sm text-muted-foreground">The operating system for Indian rooftop-solar installers — from the first enquiry to the final profit sheet.</p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-semibold">{c.title}</p>
            <ul className="mt-3 space-y-2">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-muted-foreground hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:px-6">
          <p>© 2026 SolarFlow. Made in India for the rooftop revolution.</p>
          <p>Prices exclusive of 18% GST.</p>
        </div>
      </div>
    </footer>
  );
}
