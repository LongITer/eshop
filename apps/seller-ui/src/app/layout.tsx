import './global.css';
import Providers from './provider';


export const metadata = {
  title: 'Eshop Seller',
  description: 'Manage your Eshop store, products, inventory and orders.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
