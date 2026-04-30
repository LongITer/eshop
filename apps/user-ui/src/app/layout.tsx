import Header from '../shared/widgets';
import './global.css';
import { Poppins, Roboto } from 'next/font/google'
import Provider from './providers';
import Providers from './providers';
import { Toaster } from 'react-hot-toast';

const roboto = Roboto({
  weight: ['100', '300', '400', '500', '600', '700', '900'],
  subsets: ["latin"],
  variable: "--font-roboto"
})
const poppins = Poppins({
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  subsets: ["latin"],
  variable: "--font-poppins"
})
export const metadata = {
  title: 'Eshop',
  description: 'Eshop',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${roboto.variable} ${poppins.variable}`}>
        <Providers>
          <Header />
          {children}
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  )
}
