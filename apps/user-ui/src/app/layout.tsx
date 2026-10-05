import Header, { Footer } from '../shared/widgets';
import './global.css';
import '../shared/components/chatbot/chatbot.css';
import { Poppins, Roboto } from 'next/font/google'
import Providers from './providers';
import { Toaster } from 'react-hot-toast';
import ChatbotWidget from '../shared/components/chatbot/ChatbotWidget';

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
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
          <Footer />
          <ChatbotWidget />
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  )
}
