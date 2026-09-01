import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "AgroPrice Nigeria", description: "Agricultural price intelligence" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body style={{ margin: 0, background: "#f7f8f5", color: "#172018", overflowX: "hidden" }}>{children}</body></html>;
}
