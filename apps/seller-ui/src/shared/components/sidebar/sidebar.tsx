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
import { BellPlus, BellRing, CalendarPlus, ListOrdered, LogOut, Mail, PackageSearch, Settings, SquarePlus, TicketPercent } from 'lucide-react';
import { PaymentIcon } from 'apps/seller-ui/src/assets/icons/payment';



const SidebarBarWrapper = () => {
    const { activeSidebar, setActiveSidebar } = useSidebar();
    const pathname = usePathname();
    const { seller } = useSeller();

    useEffect(() => {
        setActiveSidebar(pathname)
    }, [pathname, seller])

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
                </Box>
            </SideBar.Header>
            <div className='block my-3 h-full'>
                <SideBar.Body className="body sidebar">
                    <SidebarItem
                        title='Dashboard'
                        icon={<HomeIcon fill={getIconColor('/dashboard')} />}
                        isActive={activeSidebar === '/dashboard'}
                        href='/dashboard'
                    >
                    </SidebarItem>
                    <div className='mt-2 block'>
                        <SidebarMenu title='Main Menu'>
                            <SidebarItem
                                title='Order'
                                icon={<ListOrdered size={23} strokeWidth={1.5} color={getIconColor('/dashboard/orders')} />}
                                isActive={activeSidebar === '/dashboard/orders'}
                                href='/dashboard/orders'
                            >
                            </SidebarItem>
                            <SidebarItem
                                title='Payment'
                                icon={<PaymentIcon fill={getIconColor('/dashboard/payment')} />}
                                isActive={activeSidebar === '/dashboard/payment'}
                                href='/dashboard/payment'
                            >
                            </SidebarItem>
                            <SidebarMenu title='Products'>
                                <SidebarItem
                                    title='Add Product'
                                    icon={<SquarePlus size={22} strokeWidth={1.5} color={getIconColor('/dashboard/create-product')} />}
                                    isActive={activeSidebar === '/dashboard/create-product'}
                                    href='/dashboard/create-product'
                                >
                                </SidebarItem>
                                <SidebarItem
                                    title='All Products'
                                    icon={<PackageSearch size={22} strokeWidth={1.5} color={getIconColor('/dashboard/all-products')} />}
                                    isActive={activeSidebar === '/dashboard/all-products'}
                                    href='/dashboard/all-products'
                                >
                                </SidebarItem>
                            </SidebarMenu>

                            <SidebarMenu title='Events'>
                                <SidebarItem
                                    title='Create Event'
                                    icon={<CalendarPlus size={22} strokeWidth={1.5} color={getIconColor('/dashboard/create-event')} />}
                                    isActive={activeSidebar === '/dashboard/create-event'}
                                    href='/dashboard/create-event'
                                >
                                </SidebarItem>
                                <SidebarItem
                                    title='All Events'
                                    icon={<BellPlus size={22} strokeWidth={1.5} color={getIconColor('/dashboard/all-events')} />}
                                    isActive={activeSidebar === '/dashboard/all-events'}
                                    href='/dashboard/all-events'
                                >
                                </SidebarItem>
                            </SidebarMenu>
                            <SidebarMenu title='Controllers'>
                                <SidebarItem
                                    title='Inbox'
                                    icon={<Mail size={22} strokeWidth={1.5} color={getIconColor('/dashboard/inbox')} />}
                                    isActive={activeSidebar === '/dashboard/inbox'}
                                    href='/dashboard/inbox'
                                ></SidebarItem>
                                <SidebarItem
                                    title='Setting'
                                    icon={<Settings size={22} strokeWidth={1.5} color={getIconColor('/dashboard/setting')} />}
                                    isActive={activeSidebar === '/dashboard/setting'}
                                    href='/dashboard/setting'
                                ></SidebarItem>
                                <SidebarItem
                                    title='Notifications'
                                    icon={<BellRing size={22} strokeWidth={1.5} color={getIconColor('/dashboard/notification')} />}
                                    isActive={activeSidebar === '/dashboard/notification'}
                                    href='/dashboard/notification'
                                ></SidebarItem>
                            </SidebarMenu>

                            <SidebarMenu title='Extras'>
                                <SidebarItem
                                    title='Discount Codes'
                                    icon={<TicketPercent size={22} strokeWidth={1.5} color={getIconColor('/dashboard/discount-codes')} />}
                                    isActive={activeSidebar === '/dashboard/discount-codes'}
                                    href='/dashboard/discount-codes'
                                ></SidebarItem>
                                <SidebarItem
                                    title='Logout'
                                    icon={<LogOut size={22} strokeWidth={1.5} color={getIconColor('/dashboard/logout')} />}
                                    isActive={activeSidebar === '/dashboard/logout'}
                                    href='/dashboard/logout'
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