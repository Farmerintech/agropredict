"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ title, status, children }: { title: string; status: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <main className="app-shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="main-content">
        <div className="shell">
          <header className="topbar">
            <button
              className="hamburger"
              aria-label="Toggle navigation"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >☰</button>
            <h1 className="page-title">{title}</h1>
            {status}
          </header>
          {children}
        </div>
      </div>
    </main>
  );
}
