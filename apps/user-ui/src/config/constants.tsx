export const navItems: NavItemsTypes[] = [
    { title: "Trang chủ", href: "/" },
    { title: "Sản phẩm", href: "/products" },
    { title: "Lắp PC", href: "/pc-builder" },
    { title: "Cửa hàng", href: "/shop" },
    { title: "Ưu đãi", href: "/offers" },
    { title: "Bán hàng", href: `${process.env.NEXT_PUBLIC_SELLER_SERVER_URI || "http://localhost:3001"}/signup` }
]
