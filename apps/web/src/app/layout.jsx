import './globals.css';
export const metadata = {
  title: 'Texa — Find your people. Discover your next.',
  description: 'A new space for creative people, meaningful connections, and independent finds.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/logo.svg', apple: '/logo.svg' },
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#f7f8fa' };
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
