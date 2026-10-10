'use client'
import useSeller from 'apps/seller-ui/src/hooks/useSeller';
import useSidebar from 'apps/seller-ui/src/hooks/useSidebar'
import { usePathname } from 'next/navigation';
import React, { useEffect } from 'react'
import Box from '../box';
import { SideBar } from './sidebar.style';
import Link from 'next/link';
import Logo from 'apps/seller-ui/src/assets/svgs/Logo';
import SidebarItem from './sidebar.item';
import { HomeIcon } from 'apps/seller-ui/src/assets/icons/home';
import SidebarMenu from './sidebar.menu';
import { BarChart3, Boxes, BellPlus, BellRing, CalendarPlus, ListOrdered, LogOut, Mail, PackageSearch, Settings, SquarePlus, TicketPercent } from 'lucide-react';
import { PaymentIcon } from 'apps/seller-ui/src/assets/icons/payment';
import { UnreadMessages } from '@packages/components/chat';
import axiosInstance from 'apps/seller-ui/src/utils/axioInstance';
import { useRouter } from 'next/navigation';
import { LanguageSwitcher, useLanguage } from '@packages/components/language-switcher';



const SidebarBarWrapper = () => {
    const { activeSidebar, setActiveSidebar } = useSidebar();
    const pathname = usePathname();
    const { seller } = useSeller();
    const router = useRouter();
    const { language } = useLanguage();
    const vi = language === 'vi';
    const translate: Record<string, string> = { Dashboard: 'Tổng quan', 'Main Menu': 'Menu chính', Order: 'Đơn hàng', Payment: 'Thanh toán', 'Revenue reports': 'Báo cáo doanh thu', Products: 'Sản phẩm', 'Add Product': 'Thêm sản phẩm', 'All Products': 'Tất cả sản phẩm', Inventory: 'Kho hàng', Events: 'Sự kiện', 'Create Event': 'Tạo sự kiện', 'All Events': 'Tất cả sự kiện', Controllers: 'Điều khiển', Inbox: 'Hộp thư', 'Shop settings': 'Cài đặt cửa hàng', Notifications: 'Thông báo', Extras: 'Tiện ích', 'Discount Codes': 'Mã giảm giá', Logout: 'Đăng xuất' };
    const label = (value: string) => vi ? translate[value] ?? value : value;
    const logout = async (event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); await axiosInstance.get('/api/logout-seller'); router.replace('/login'); };

    useEffect(() => {
        setActiveSidebar(pathname)
    }, [pathname, setActiveSidebar])

    const getIconColor = (route: string) => activeSidebar === route ? "#0085ff" : "#969696"

    return (
        <Box
            css={{
                height: "100vh",
                zIndex: "202",
                position: "sticky",
                top: "0",
            }}
            className="sidebar-wrapper"
        >
            <SideBar.Header>
                <Box>
                    <Link href={"/"} className='flex justify-center text-center gap-2'>
                        <Logo />
                        <Box className='text-center font-medium text-[#ecedee]'>
                            <h3>{seller?.shop?.name}</h3>
                            <h5 className='font-medium text-xs text-[#ecedee] whitespace-nowrap overflow-hidden text-ellipsis max-w-[170px]'>
                                {seller?.shop?.address}
                            </h5>
                        </Box>
                    </Link>
                    <div className="mt-3 flex justify-center"><LanguageSwitcher /></div>
                </Box>
            </SideBar.Header>
            <div className='block my-3 h-full'>
                <SideBar.Body className="body sidebar">
                            <SidebarItem
                        title={label('Dashboard')}
                        icon={<HomeIcon fill={getIconColor('/dashboard')} />}
                        isActive={activeSidebar === '/dashboard'}
                        href='/dashboard'
                    >
                    </SidebarItem>
                    <div className='mt-2 block'>
                        <SidebarMenu title={label('Main Menu')}>
                            <SidebarItem
                                title={label('Order')}
                                icon={<ListOrdered size={23} strokeWidth={1.5} color={getIconColor('/dashboard/orders')} />}
                                isActive={activeSidebar === '/dashboard/orders'}
                                href='/dashboard/orders'
                            >
                            </SidebarItem>
                            <SidebarItem
                                title={label('Payment')}
                                icon={<PaymentIcon fill={getIconColor('/dashboard/payment')} />}
                                isActive={activeSidebar === '/dashboard/payment'}
                                href='/dashboard/payment'
                            >
                            </SidebarItem>
                            <SidebarItem
                                title={label('Revenue reports')}
                                icon={<BarChart3 size={22} strokeWidth={1.5} color={getIconColor('/dashboard/reports')} />}
                                isActive={activeSidebar === '/dashboard/reports'}
                                href='/dashboard/reports'
                            />
                            <SidebarMenu title={label('Products')}>
                                <SidebarItem
                                    title={label('Add Product')}
                                    icon={<SquarePlus size={22} strokeWidth={1.5} color={getIconColor('/dashboard/create-product')} />}
                                    isActive={activeSidebar === '/dashboard/create-product'}
                                    href='/dashboard/create-product'
                                >
                                </SidebarItem>
                                <SidebarItem
                                    title={label('All Products')}
                                    icon={<PackageSearch size={22} strokeWidth={1.5} color={getIconColor('/dashboard/all-products')} />}
                                    isActive={activeSidebar === '/dashboard/all-products' || pathname.startsWith('/dashboard/edit-product/')}
                                    href='/dashboard/all-products'
                                >
                                </SidebarItem>
                                <SidebarItem
                                    title={label('Inventory')}
                                    icon={<Boxes size={22} strokeWidth={1.5} color={getIconColor('/dashboard/inventory')} />}
                                    isActive={activeSidebar === '/dashboard/inventory'}
                                    href='/dashboard/inventory'
                                />
                            </SidebarMenu>

                            <SidebarMenu title={label('Events')}>
                                <SidebarItem
                                    title={label('Create Event')}
                                    icon={<CalendarPlus size={22} strokeWidth={1.5} color={getIconColor('/dashboard/create-event')} />}
                                    isActive={activeSidebar === '/dashboard/create-event'}
                                    href='/dashboard/create-event'
                                >
                                </SidebarItem>
                                <SidebarItem
                                    title={label('All Events')}
                                    icon={<BellPlus size={22} strokeWidth={1.5} color={getIconColor('/dashboard/all-events')} />}
                                    isActive={activeSidebar === '/dashboard/all-events'}
                                    href='/dashboard/all-events'
                                >
                                </SidebarItem>
                            </SidebarMenu>
                            <SidebarMenu title={label('Controllers')}>
                                {seller && <UnreadMessages api={axiosInstance} href="/dashboard/inbox" renderLink={count => (
                                    <SidebarItem
                                        title={label('Inbox')}
                                        icon={<Mail size={22} strokeWidth={1.5} color={getIconColor('/dashboard/inbox')} />}
                                        isActive={activeSidebar === '/dashboard/inbox'}
                                        href='/dashboard/inbox'
                                        badge={count}
                                    />
                                )} />}
                                <SidebarItem
                                    title={label('Shop settings')}
                                    icon={<Settings size={22} strokeWidth={1.5} color={getIconColor('/dashboard/shop-settings')} />}
                                    isActive={activeSidebar === '/dashboard/shop-settings'}
                                    href='/dashboard/shop-settings'
                                ></SidebarItem>
                                <SidebarItem
                                    title={label('Notifications')}
                                    icon={<BellRing size={22} strokeWidth={1.5} color={getIconColor('/dashboard/notification')} />}
                                    isActive={activeSidebar === '/dashboard/notification'}
                                    href='/dashboard/notification'
                                ></SidebarItem>
                            </SidebarMenu>

                            <SidebarMenu title={label('Extras')}>
                                <SidebarItem
                                    title={label('Discount Codes')}
                                    icon={<TicketPercent size={22} strokeWidth={1.5} color={getIconColor('/dashboard/discount-codes')} />}
                                    isActive={activeSidebar === '/dashboard/discount-codes'}
                                    href='/dashboard/discount-codes'
                                ></SidebarItem>
                                <SidebarItem
                                    title={label('Logout')}
                                    icon={<LogOut size={22} strokeWidth={1.5} color={getIconColor('/dashboard/logout')} />}
                                    isActive={activeSidebar === '/dashboard/logout'}
                                    href='/dashboard/logout'
                                    onClick={logout}
                                ></SidebarItem>
                            </SidebarMenu>
                        </SidebarMenu>
                    </div>
                </SideBar.Body>
            </div>
        </Box>
    )
}

export default SidebarBarWrapper
