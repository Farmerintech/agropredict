"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const WFP_SOURCE_HREF = "/dashboard?source=wfp_hdx";

export default function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const onDataView = pathname === "/dashboard";
  const onAnalytics = pathname === "/analytics";
  const onPredict = pathname === "/predict";

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={open ? "sidebar open" : "sidebar"}>
        <Link href="/" className="brand" aria-label="AgroPrice home">
          <span className="brand-mark">₦</span>AgroPrice <em>NG</em>
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/dashboard" aria-current={onDataView ? "page" : undefined}>Overview</Link>
          <Link href="/analytics" aria-current={onAnalytics ? "page" : undefined}>Analytics</Link>
          <Link href="/predict" aria-current={onPredict ? "page" : undefined}>Predict</Link>
        </nav>
        <div className="side-section">
          <span>DATA SOURCES</span>
          <Link
            className={onDataView ? "source-active" : undefined}
            href={WFP_SOURCE_HREF}
            aria-current={onDataView ? "page" : undefined}
          >
            ● WFP / HDX {onDataView && <small>Active</small>}
          </Link>
          <button disabled>○ World Bank <small>Soon</small></button>
          <button disabled>○ NBS Watch <small>Soon</small></button>
        </div>
        <div className="side-foot">Research dashboard<br /><span>v0.1 · Nigeria</span></div>
      </aside>
    </>
  );
}
