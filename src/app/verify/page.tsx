"use client";
import { useEffect, useState } from "react";
import { publicClient } from "@/lib/viem";
import { COMMIT_REGISTRY_ADDRESS, commitRegistryAbi } from "@/lib/contracts";
import { formatEther } from "viem";

type Proof = {
  commitment: string;
  stealthAddress: string;
  amount: bigint;
  timestamp?: bigint; // Block timestamp if we fetch it, but event doesn't have it directly without getBlock
};

export default function VerifyPage() {
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [total, setTotal] = useState<bigint>(0n);

  useEffect(() => {
    async function load() {
      if (!COMMIT_REGISTRY_ADDRESS) return;
      
      try {
        const logs = await publicClient.getContractEvents({
          address: COMMIT_REGISTRY_ADDRESS,
          abi: commitRegistryAbi,
          eventName: 'SupportCommitted',
          fromBlock: 'earliest',
        });

        const items: Proof[] = logs.map((l) => ({
          commitment: l.args.commitment as string,
          stealthAddress: l.args.stealthAddress as string,
          amount: l.args.amount as bigint,
        }));

        setProofs(items);
        setTotal(items.reduce((acc, b) => acc + b.amount, 0n));
      } catch (e) {
        console.error("Failed to load proofs", e);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="text-3xl font-semibold text-black dark:text-zinc-50">Public Proofs</h2>
        <p className="mt-2 text-zinc-700 dark:text-zinc-300">
          Total supporters: {proofs.length} • Combined support: {formatEther(total)} ETH
        </p>
        <div className="mt-6 space-y-3">
          {proofs.map((b, i) => (
            <div
              key={i}
              className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            >
              <div className="text-sm text-zinc-700 dark:text-zinc-300 font-mono break-all">
                Stealth Address: {b.stealthAddress}
              </div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Amount: {formatEther(b.amount)} ETH
              </div>
              <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 font-mono break-all">
                Commitment: {b.commitment}
              </div>
            </div>
          ))}
          {proofs.length === 0 && (
            <div className="text-sm text-zinc-700 dark:text-zinc-300">No proofs yet.</div>
          )}
        </div>
      </main>
    </div>
  );
}
