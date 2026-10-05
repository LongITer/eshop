import Link from 'next/link'
import React from 'react'

interface Props {
    icon: React.ReactNode,
    title: string,
    isActive?: boolean,
    badge?: number,
    href: string
}

const SidebarItem = ({ icon, title, isActive, href, badge }: Props) => {
    return (
        <Link href={href} aria-current={isActive ? 'page' : undefined} className='block'>
            <div className={`flex gap-2 w-full min-h-11 h-full items-center px-[13px] rounded-lg cursor-pointer transition hover:bg-[#2b2f31]
                ${isActive ? 'scale-[.98] bg-[#0f3158] text-blue-200' : 'bg-[#58290f00] fill-blue-200 hover:bg-[#1b75f291]'}
                `}>
                {icon}
                <h5 className='text-scale-200 text-lg'>
                    {title}
                </h5>
                {!!badge && badge > 0 && <span aria-label={`${badge} unread messages`} className="ml-auto rounded-full bg-blue-600 px-2 text-xs text-white">{badge}</span>}
            </div>
        </Link>
    )
}

export default SidebarItem