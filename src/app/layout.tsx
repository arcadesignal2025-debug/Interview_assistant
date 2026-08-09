import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Technical Interview Agent | 31-Day AI Engineering Cohort',
  description: 'Adaptive, multi-turn AI technical interview agent for 31-day AI engineering cohort candidates.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-dark-bg text-gray-100 antialiased selection:bg-violet-deep selection:text-white">
        {children}
      </body>
    </html>
  );
}
