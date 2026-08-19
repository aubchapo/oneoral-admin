import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'OneOral Admin',
  description: 'OneOral Admin Portal & CRM',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Apply the stored theme before first paint so dark mode doesn't
            flash light. Defaults to the OS preference when unset. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('oo-admin-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
