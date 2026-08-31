"use client";
import Sidebar from "./Sidebar";
export default function MahiWALayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Sidebar />
      <main className="md:ml-">
        {children}
      </main>
    </div>
  );
}