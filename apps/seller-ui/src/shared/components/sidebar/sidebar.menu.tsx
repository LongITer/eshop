import React from 'react'

interface Props {
    title: string,
    children: React.ReactNode
}

const SidebarMenu = ({ title, children }: Props) => {
    return (
        <div className='block'>
            <h3 className='text-xs font-medium tracking-wider pl-1 text-[#ffffff] py-3'> {title}</h3>
            {children}
        </div>
    )
}

export default SidebarMenu