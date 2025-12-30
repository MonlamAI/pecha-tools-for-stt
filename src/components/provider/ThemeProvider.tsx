"use client";

import { ThemeProvider as NextThemes } from "next-themes";
import { useEffect } from "react";

export function ThemeProvider({ children, ...props }: any) {
  return (
    <NextThemes
      attribute="class"
      defaultTheme="system"
      enableSystem={true}
      {...props}
    >
      <ThemeSync>{children}</ThemeSync>
    </NextThemes>
  );
}

function ThemeSync({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;

    const observer = new MutationObserver(() => {
      const isDark = html.classList.contains("dark");
      html.setAttribute("data-theme", isDark ? "dark" : "light");
    });

    observer.observe(html, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return <>{children}</>;
}
