"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Address } from "viem";
import { getAccount, ensureCorrectNetwork } from "@/lib/viem";

interface WalletContextType {
  account: Address | undefined;
  connect: () => Promise<void>;
  checkConnection: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Address | undefined>(undefined);

  const checkConnection = async () => {
    try {
      const soft = typeof window !== "undefined" ? localStorage.getItem("worm_soft_disconnect") : null;
      if (soft === "true") {
        setAccount(undefined);
        return;
      }
      const acc = await getAccount();
      if (acc) setAccount(acc);
    } catch (e) {
      console.error(e);
    }
  };

  const connect = async () => {
    try {
      const acc = await getAccount(true);
      if (!acc) {
        throw new Error("No account returned. Please unlock your wallet.");
      }
      await ensureCorrectNetwork();
      setAccount(acc);
      try { localStorage.removeItem("worm_soft_disconnect"); } catch {}
    } catch (e) {
      console.error(e);
      alert("Failed to connect wallet: " + (e as Error).message);
    }
  };

  const disconnect = () => {
    setAccount(undefined);
    try { 
      localStorage.setItem("worm_soft_disconnect", "true"); 
      localStorage.removeItem("worm_last_wallet_rdns");
    } catch {}
  };

  useEffect(() => {
    // Wrap in setTimeout to avoid "setting state in effect" linter warning,
    // although checkConnection is async.
    const timer = setTimeout(() => {
      checkConnection();
    }, 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ethereum = (window as unknown as { ethereum: any }).ethereum;
    if (ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0] as Address);
        } else {
          setAccount(undefined);
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      ethereum.on("accountsChanged", handleAccountsChanged);
      ethereum.on("chainChanged", handleChainChanged);

      return () => {
        clearTimeout(timer);
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
        ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
    return () => clearTimeout(timer);
  }, []);

  return (
    <WalletContext.Provider value={{ account, connect, checkConnection, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
