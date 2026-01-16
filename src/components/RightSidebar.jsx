"use client";
import { useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import BurgerIcon from "./BurgerIcon";
import ThemeToggle from "./ThemeToggle";

function SidebarContent({ children }) {
  const [showSidebar, setShowSidebar] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const session = searchParams.get("session");
  // Hide toggle if on dashboard OR if session param exists
  const isSessionPage = pathname?.includes("/dashboard") || !!session;

  return (
    <>
      <div className="fixed z-50 flex justify-between items-center gap-4 px-4 top-2 w-full">
        {isSessionPage ?
          <div className="flex w-full justify-end">
            {showSidebar ? (
              <button
                className="flex items-center text-3xl text-white cursor-pointer"
                onClick={() => setShowSidebar((prev) => !prev)}
              >
                ❌
              </button>
            ) : (
              <BurgerIcon setShowSidebar={setShowSidebar} />
            )}
          </div>
          :
          <ThemeToggle />}
      </div>

      <div
        className={`top-0 right-0 w-[90vw] md:w-[50vw] bg-[#54606e] md:p-5 p-1 text-white fixed h-full z-40  ease-in-out duration-300 ${showSidebar ? "translate-x-0 " : "translate-x-full"
          }`}
      >
        <div className="h-full flex flex-col space-y-2">{children}</div>
      </div>
    </>
  );
}

export default function Sidebar({ children }) {
  return (
    <Suspense fallback={null}>
      <SidebarContent>{children}</SidebarContent>
    </Suspense>
  );
}
