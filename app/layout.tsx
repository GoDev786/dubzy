import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "dubzy", description: "Translate UGC video voiceovers" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
