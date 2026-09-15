'use client';

import Link from 'next/link';

interface BreadcrumbsProps {
  items: Array<{
    label: string;
    href?: string;
    active?: boolean;
  }>;
  separator?: React.ReactNode;
  className?: string;
}

const Breadcrumbs = ({
  items,
  separator = <span className="mx-2 text-slate-400">&rsaquo;</span>,
  className = '',
}: BreadcrumbsProps) => {
  return (
    <nav className={`flex items-center text-slate-400 text-sm mb-6 ${className}`} aria-label="breadcrumb">
      <ol className="flex items-center space-x-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isActive = item.active ?? isLast;

          return (
            <li key={item.label} className="flex items-center">
              {isLast && !item.href ? (
                <span className={isActive ? 'text-white' : 'text-slate-400'}>
                  {item.label}
                </span>
              ) : (
                <Link href={item.href ?? '#'} className={isActive ? 'text-white' : 'text-slate-400 hover:text-white transition'}>
                  {item.label}
                </Link>
              )}
              {!isLast && separator}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;