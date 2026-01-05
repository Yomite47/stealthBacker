"use client";

import Link from "next/link";
import { useWallet } from "@/context/WalletContext";
import { useEffect, useRef, useState } from "react";
import { setWalletProvider } from "@/lib/viem";

export default function Navbar() {
  const { account, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  type AnnouncedProvider = { info: { name: string; rdns?: string; icon?: string }, provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } };
  const [providers, setProviders] = useState<AnnouncedProvider[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const connectRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
      if (connectRef.current && !connectRef.current.contains(e.target as Node)) setShowConnect(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setShowConnect(false); }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  useEffect(() => {
    const announced = new Map<string, AnnouncedProvider>();
    const onAnnounce = (event: Event) => {
      const d = (event as unknown as { detail?: AnnouncedProvider }).detail;
      if (!d?.info?.rdns || announced.has(d.info.rdns)) return;
      announced.set(d.info.rdns, d);
      setProviders(Array.from(announced.values()));
    };
    window.addEventListener("eip6963:announce", onAnnounce);
    window.dispatchEvent(new Event("eip6963:request"));
    const injected = (window as unknown as { ethereum?: AnnouncedProvider["provider"] }).ethereum;
    const t = setTimeout(() => {
      if (announced.size === 0 && injected) {
        setProviders([{ info: { name: "Browser Wallet", rdns: "injected" }, provider: injected }]);
      }
    }, 300);
    return () => {
      window.removeEventListener("eip6963:announce", onAnnounce);
      clearTimeout(t);
    };
  }, []);

  return (
    <nav className="sticky top-0 z-50 border-b border-worm-green/20 bg-panel/80 backdrop-blur-md px-6 py-4 flex justify-between items-center">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2 group">
           <div className="w-8 h-8 rounded-full bg-worm-green/10 border border-worm-green/30 flex items-center justify-center group-hover:bg-worm-green/20 transition-all">
             <span className="text-worm-green font-bold">W</span>
           </div>
           <span className="text-lg font-bold tracking-tight text-text-primary group-hover:text-worm-green transition-colors">
            StealthBacker
           </span>
        </Link>
        <div className="hidden md:flex gap-6 text-sm font-medium text-text-muted">
          <Link href="/support" className="hover:text-worm-green transition-colors">Supporters</Link>
          <Link href="/register" className="hover:text-worm-green transition-colors">Creators</Link>
          <Link href="/dashboard" className="hover:text-worm-green transition-colors">Dashboard</Link>
        </div>
      </div>

      <div className="relative">
        {account ? (
          <>
            <button
              onClick={() => setOpen(v => !v)}
              className="flex items-center gap-3 px-4 py-2 bg-black/40 border border-worm-green/20 rounded-full text-sm font-mono text-worm-green shadow-[0_0_10px_rgba(58,242,107,0.1)] hover:border-worm-green transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-worm-green animate-pulse"></div>
              <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
            </button>
            {open && (
              <div ref={menuRef} className="absolute right-0 mt-2 w-64 bg-panel border border-worm-green/20 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.3)] overflow-hidden">
                <div className="px-4 py-3 bg-black/30 border-b border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-mono text-text-muted">{account.slice(0,10)}...{account.slice(-4)}</div>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(account);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1200);
                        } catch {}
                      }}
                      className="px-2 py-1 text-xs rounded bg-white/5 border border-white/10 text-text-muted hover:text-worm-green hover:border-worm-green transition-colors"
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <a
                    href={`https://sepolia.etherscan.io/address/${account}`}
                    target="_blank"
                    className="mt-2 block text-xs text-worm-green hover:underline"
                  >
                    View on SepoliaScan
                  </a>
                </div>
                <div className="py-1">
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-white hover:bg-white/5"
                    onClick={() => setOpen(false)}
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => { setShowConnect(true); setOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5"
                  >
                    Switch Wallet
                  </button>
                  <div className="my-1 border-t border-white/10" />
                  <button
                    onClick={() => { disconnect(); setOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-white/5"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
          <button
            onClick={() => setShowConnect(true)}
            className="px-5 py-2 bg-transparent border border-worm-green text-worm-green text-sm font-bold rounded-lg hover:bg-worm-green hover:text-black transition-all shadow-[0_0_0_transparent] hover:shadow-[0_0_15px_rgba(58,242,107,0.4)]"
          >
            Connect Wallet
          </button>
          {showConnect && (
            <div className="absolute right-0 mt-2 w-72" ref={connectRef}>
              <div className="bg-panel border border-worm-green/20 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.3)] overflow-hidden">
                <div className="px-4 py-3 bg-black/30 border-b border-white/10 text-sm">Choose a wallet</div>
                <div className="py-1">
                  {providers.map((p, i) => (
                    <button
                      key={i}
                      onClick={async () => { setWalletProvider(p?.provider); await connect(); setShowConnect(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5 flex items-center gap-3"
                    >
                      {p.info?.icon ? <img src={p.info.icon} alt="" className="w-5 h-5 rounded" /> : <div className="w-5 h-5 rounded bg-worm-green/20" />}
                      <span>{p.info?.name || "Wallet"}</span>
                    </button>
                  ))}
                  {providers.length === 0 && (
                    <div className="px-4 py-2 text-sm text-text-muted">No wallet detected</div>
                  )}
                </div>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </nav>
  );
}
