import React from 'react'
import SidebarBarWrapper from '../../shared/components/sidebar/sidebar'
import MobileNav from '@packages/components/mobile-nav';

const Layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className='flex flex-col md:flex-row h-full bg-black min-h-screen print:bg-white'>
            <div className="text-white print:hidden"><MobileNav links={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Products', href: '/dashboard/all-products' }, { label: 'Create product', href: '/dashboard/create-product' }, { label: 'Orders', href: '/dashboard/orders' }, { label: 'Inventory', href: '/dashboard/inventory' }, { label: 'Reports', href: '/dashboard/reports' }, { label: 'Shop settings', href: '/dashboard/shop-settings' }, { label: 'Inbox', href: '/dashboard/inbox' }, { label: 'Notifications', href: '/dashboard/notification' }]} /></div>
            {/* sidebar */}
            <aside className='hidden md:block print:!hidden w-[280px] min-w-[250px] max-w-[300px] border-r border-r-slate-800 text-white p-4'>
                <div className='sticky top-0 '>
                    <SidebarBarWrapper />
                </div>
            </aside>
            {/* Main conten area */}
            <main className='flex-1 min-w-0'>
                <div className='overflow-auto'>{children}</div>
            </main>
        </div>
    )
}

export default Layout

