import SidebarWrapper from "../shared/component/sidebar";

const layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex w-full bg-black min-h-screen">
      {/* Sidebar */}
      <aside className="w-[280px] min-w-[250px] max-w-[300px] border-r border-r-slate-800 text-white">
        <div className="sticky top-0">
          <SidebarWrapper />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        <div className="overflow-auto">{children}</div>
      </main>
    </div>
  );
};

export default layout;