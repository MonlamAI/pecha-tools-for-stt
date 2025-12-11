"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react"; // ✅ icons added

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync DaisyUI with Tailwind's dark class
  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    const current = resolvedTheme;

    html.setAttribute("data-theme", current === "dark" ? "dark" : "light");
  }, [resolvedTheme, mounted]);

  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";

    // Update next-themes
    setTheme(next);

    // Update DaisyUI theme
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <label className="relative inline-flex items-center cursor-pointer gap-2">

      {/* 🌞 Sun icon when light mode */}
      {!isDark && <Sun className="w-5 h-5 text-yellow-500 transition-all" />}

      {/* 🌙 Moon icon when dark mode */}
      {isDark && <Moon className="w-5 h-5 text-blue-400 transition-all" />}

      <input
        type="checkbox"
        className="sr-only peer"
        checked={isDark}
        onChange={toggleTheme}
      />

      <div
        className="
          w-9 h-5 bg-gray-200 border border-gray-400 
          peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 
          rounded-full relative
          peer peer-checked:after:translate-x-full
          after:content-[''] after:absolute after:top-[2px] after:left-[2px]
          after:bg-white after:border-gray-300 after:border 
          after:rounded-full after:h-4 after:w-4 after:transition-all
          peer-checked:bg-blue-600
        "
      ></div>

      <span className="text-sm font-medium text-base-content">
        {isDark ? "Dark" : "Light"}
      </span>
    </label>
  );
}
