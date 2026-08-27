import './globals.css';
import Shell from '../components/Shell';
import { AuthProvider } from '../components/AuthProvider';

export const metadata = {
  title: { default: 'TTPL UI Laboratory', template: '%s · TTPL UI' },
  description: 'Laboratorium Tegangan Tinggi dan Pengukuran Listrik, Fakultas Teknik Universitas Indonesia.',
  icons: { icon: '/assets/ttpl-logo.png', shortcut: '/assets/ttpl-logo.png', apple: '/assets/ttpl-logo.png' },
  metadataBase: new URL('https://ttpl-ui-website.vercel.app')
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider><Shell>{children}</Shell></AuthProvider>
      </body>
    </html>
  );
}
