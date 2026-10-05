import SidebarWrapper from "../shared/component/sidebar";
import MobileNav from '@packages/components/mobile-nav';

const layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-col md:flex-row w-full bg-black min-h-screen">
      <div className="text-white"><MobileNav links={[{ label: 'Dashboard', href: '/dashboard' }, ...['orders', 'products', 'users', 'sellers', 'payments', 'notifications', 'loggers', 'log-settings'].map(label => ({ label, href: `/dashboard/${label}` }))]} /></div>
      {/* Sidebar */}
      <aside className="hidden md:block w-[280px] min-w-[250px] max-w-[300px] border-r border-r-slate-800 text-white">
        <div className="sticky top-0">
          <SidebarWrapper />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="overflow-auto">{children}</div>
      </main>
    </div>
  );
};

export default layout;
