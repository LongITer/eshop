export const navItems: NavItemsTypes[] = [
    { title: "Home", href: "/" },
    { title: "Products", href: "/products" },
    { title: "Shop", href: "/shop" },
    { title: "Offer", href: "/offers" },
    { title: "Become A Seller", href: `${process.env.NEXT_PUBLIC_SELLER_SERVER_URI || "http://localhost:3001"}/signup` }
]