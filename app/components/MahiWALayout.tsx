"use client";
import Sidebar from "./Sidebar";

export default function MahiWALayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <Sidebar />
      <main style={{ marginLeft: '220px', width: 'calc(100% - 220px)' }} className="min-h-screen">
        {children}
      </main>
    </div>
  );
}