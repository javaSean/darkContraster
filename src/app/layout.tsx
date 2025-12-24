import type { Metadata } from 'next';
import { StickyBanner } from '../components/StickyBanner';
import { CartProvider } from '../context/CartContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dark Contraster — Artist Portfolio',
  description:
    'Immersive digital art gallery and shop featuring limited edition works and exclusive artist stories.',
  icons: {
    icon: '/images/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <StickyBanner />
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
