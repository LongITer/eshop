import "./global.css";
import Providers from "./provider";

export const metadata = {
  title: "Eshop Admin | Marketplace management",
  description: "Manage marketplace orders, payments, sellers and customers with Eshop Admin.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`min-h-screen bg-slate-900 font-sans antialiased `}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
