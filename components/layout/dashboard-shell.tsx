'use client';

/**
 * Dashboard shell layout.
 *
 * Production rationale:
 * - Sidebar navigation for desktop, bottom nav for mobile
 * - Header shows system status and user actions
 * - Content area is scrollable independently
 * - Responsive: collapses to mobile-friendly layout on small screens
 */

import { type ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Activity,
  CreditCard,
  Wallet,
  AlertTriangle,
  Lightbulb,
  Settings,
  Menu,
  X,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/providers';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: Activity },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/payouts', label: 'Payouts', icon: Wallet },
  { href: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/insights', label: 'Insights', icon: Lightbulb },
];

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-100',
        collapsed && 'justify-center px-2'
      )}
      title={collapsed ? item.label : undefined}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="h-8 w-8"
      title={`Theme: ${theme}`}
    >
      {theme === 'light' && <Sun className="h-4 w-4" />}
      {theme === 'dark' && <Moon className="h-4 w-4" />}
      {theme === 'system' && <Monitor className="h-4 w-4" />}
    </Button>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-gray-900 dark:bg-gray-100">
              <CreditCard className="h-4 w-4 text-white dark:text-gray-900" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              PayFlow Ops
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            'hidden shrink-0 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 md:flex md:flex-col',
            sidebarCollapsed ? 'w-14' : 'w-52'
          )}
        >
          <nav className="flex flex-1 flex-col gap-1 p-2">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} collapsed={sidebarCollapsed} />
            ))}
          </nav>

          {/* Collapse toggle */}
          <div className="border-t border-gray-200 p-2 dark:border-gray-800">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <Menu className="h-4 w-4" />
              {!sidebarCollapsed && <span className="ml-2">Collapse</span>}
            </Button>
          </div>
        </aside>

        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-64 transform border-r border-gray-200 bg-white transition-transform dark:border-gray-800 dark:bg-gray-900 md:hidden',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex h-14 items-center border-b border-gray-200 px-4 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Navigation
            </span>
          </div>
          <nav className="flex flex-col gap-1 p-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-100'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
