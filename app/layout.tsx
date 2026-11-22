import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

const themeInit = `try{var t=localStorage.getItem("theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // рабочая область под «чёлку» и жестовую панель
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9e6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0c1d" },
  ],
};

export const metadata: Metadata = {
  appleWebApp: { capable: true, title: "Taskly", statusBarStyle: "black-translucent" },
  title: "Taskly — AI Task Manager",
  description: "Матрица Эйзенхауэра с ИИ-разбором задач",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
