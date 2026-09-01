"use client";
import Sidebar from "./Sidebar";

export default function MahiWALayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <Sidebar />
      <main className="md:ml- w-full md:w-[calc(100%-220px)] min-h-screen">
        {children}
      </main>
    </div>
  );
}