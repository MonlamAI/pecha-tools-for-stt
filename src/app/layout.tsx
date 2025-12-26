import { Toaster } from "react-hot-toast";
import { Toaster as TaskToaster } from "sonner";
import { ThemeProvider } from "@/components/provider/ThemeProvider";

import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pecha Stt Tool",
  description: "Tool by OpenPecha for STT",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="" data-theme="light">
      <body className="min-h-screen w-full bg-white dark:bg-neutral-900 overflow-x-hidden">
        <ThemeProvider attribute="class" enableSystem={true}>
          <main className="flex flex-col min-h-screen">
            {children}
          </main>
          <Toaster position="top-center" reverseOrder={false} />
          <TaskToaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
