import './globals.css';
import Shell from '../components/Shell';
import { AuthProvider } from '../components/AuthProvider';
import { Analytics } from '@vercel/analytics/next';

export const metadata = { title: 'TTPL UI Laboratory', description: 'High Voltage and Electrical Measurement Laboratory FTUI' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider><Shell>{children}</Shell></AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
