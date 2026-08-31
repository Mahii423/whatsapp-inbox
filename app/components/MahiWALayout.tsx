"use client";
import React from "react";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

export default function MahiWALayout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <Sidebar />
      <main className="md:ml- min-h-screen p-6">
        {children}
      </main>
    </div>
  );
}