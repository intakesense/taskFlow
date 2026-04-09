'use client';

import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { BottomNavProvider, useBottomNavVisibility } from './bottom-nav-context';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
  const { visible: bottomNavVisible } = useBottomNavVisibility();

  return (
    <div className="h-[100dvh] bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className={`lg:pl-64 h-full overflow-auto ${bottomNavVisible ? 'pb-16 lg:pb-0' : ''}`}>
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      {bottomNavVisible && <BottomNav />}
    </div>
  );
}

/**
 * Main dashboard layout with sidebar and bottom nav.
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <BottomNavProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </BottomNavProvider>
  );
}
