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
  
  type AnnouncedProvider = { 
    info: { name: string; rdns?: string; icon?: string; uuid: string }; 
    provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } 
  };
  
  const [providers, setProviders] = useState<AnnouncedProvider[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { 
        setOpen(false); 
        setShowConnect(false); 
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  // EIP-6963 Discovery & Auto-Connect
  useEffect(() => {
    const announced = new Map<string, AnnouncedProvider>();
    
    const onAnnounce = (event: Event) => {
      const d = (event as unknown as { detail?: AnnouncedProvider }).detail;
      if (!d?.info?.rdns || announced.has(d.info.rdns)) return;
      
      announced.set(d.info.rdns, d);
      setProviders(Array.from(announced.values()));
      
      // Auto-connect if this is the last used wallet and we weren't disconnected explicitly
      const lastRdns = localStorage.getItem("worm_last_wallet_rdns");
      const softDisconnect = localStorage.getItem("worm_soft_disconnect");
      
      if (lastRdns === d.info.rdns && softDisconnect !== "true") {
        setWalletProvider(d.provider);
        connect().catch(console.error);
      }
    };

    window.addEventListener("eip6963:announce", onAnnounce);
    window.dispatchEvent(new Event("eip6963:request"));
    
    // Fallback for standard injected wallet (e.g. standard MetaMask without EIP6963 support yet)
    const injected = (window as unknown as { ethereum?: AnnouncedProvider["provider"] }).ethereum;
    const t = setTimeout(() => {
      if (announced.size === 0 && injected) {
        const injectedProvider = { 
          info: { name: "Browser Wallet", rdns: "injected", uuid: "injected", icon: "" }, 
          provider: injected 
        };
        setProviders([injectedProvider]);
        
        // Auto-connect injected fallback
        const lastRdns = localStorage.getItem("worm_last_wallet_rdns");
        const softDisconnect = localStorage.getItem("worm_soft_disconnect");
        if (lastRdns === "injected" && softDisconnect !== "true") {
           setWalletProvider(injected);
           connect().catch(console.error);
        }
      }
    }, 300);

    return () => {
      window.removeEventListener("eip6963:announce", onAnnounce);
      clearTimeout(t);
    };
  }, [connect]);

  const handleConnect = async (p: AnnouncedProvider) => {
    try {
      setWalletProvider(p.provider);
      if (p.info.rdns) {
        localStorage.setItem("worm_last_wallet_rdns", p.info.rdns);
        localStorage.removeItem("worm_soft_disconnect");
      }
      await connect();
      setShowConnect(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
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
            <button
              onClick={() => setShowConnect(true)}
              className="px-5 py-2 bg-transparent border border-worm-green text-worm-green text-sm font-bold rounded-lg hover:bg-worm-green hover:text-black transition-all shadow-[0_0_0_transparent] hover:shadow-[0_0_15px_rgba(58,242,107,0.4)]"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      {/* Wallet Picker Modal - Perfectly Centered */}
      {showConnect && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConnect(false)}
          />
          <div className="relative w-full max-w-sm bg-panel border border-worm-green/20 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/20">
              <h3 className="font-bold text-lg text-white">Connect Wallet</h3>
              <button 
                onClick={() => setShowConnect(false)}
                className="text-text-muted hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {providers.length > 0 ? (
                providers.map((p, i) => (
                  <button
                    key={p.info.uuid || i}
                    onClick={() => handleConnect(p)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 border border-transparent hover:border-worm-green/30 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-black/40 flex items-center justify-center border border-white/10 group-hover:border-worm-green/30">
                      {p.info.icon ? (
                        <img src={p.info.icon} alt="" className="w-6 h-6" />
                      ) : (
                        <div className="w-6 h-6 rounded bg-worm-green/20" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-white group-hover:text-worm-green transition-colors">{p.info.name}</div>
                      <div className="text-xs text-text-muted">Detected</div>
                    </div>
                    <div className="text-worm-green opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-text-muted">
                  <div className="mb-2">Searching for wallets...</div>
                  <div className="animate-spin w-5 h-5 border-2 border-worm-green border-t-transparent rounded-full mx-auto"></div>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-black/20 text-xs text-center text-text-muted border-t border-white/10">
              New to Ethereum? <a href="https://metamask.io" target="_blank" className="text-worm-green hover:underline">Get a wallet</a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
