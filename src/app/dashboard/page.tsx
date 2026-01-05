'use client';

import { useState, useEffect } from 'react';
import { publicClient, getWalletClient, ensureCorrectNetwork } from '@/lib/viem';
import { useWallet } from '@/context/WalletContext';
import { recoverStealthPrivateKey } from '@/lib/crypto';
import { COMMIT_REGISTRY_ADDRESS, PROOF_NFT_ADDRESS, commitRegistryAbi, proofNftAbi } from '@/lib/contracts';
import { Address, formatEther, encodePacked, parseSignature, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// --- Icons ---
const WalletIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
);
const ZapIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);
const ShieldIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);
const DownloadIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);
const RefreshIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
);

type NftItem = {
    id: string;
    uri: string;
    metadata: Record<string, unknown>;
  };

type DepositItem = {
  stealthAddress: Address;
  amount: bigint;
  stealthPrivateKey: string;
};

export default function Dashboard() {
  const { account } = useWallet();
  
  // Creator State
  const [scanning, setScanning] = useState(false);
  const [deposits, setDeposits] = useState<DepositItem[]>([]);
  const [redeeming, setRedeeming] = useState<string | null>(null); // stealthAddress being redeemed
  const [scanStatus, setScanStatus] = useState('');

  useEffect(() => {
    // Creator scan is manual
  }, [account]);

  const scanForDeposits = async () => {
    if (!account || !COMMIT_REGISTRY_ADDRESS) return;
    
    const storedKey = localStorage.getItem(`worm_sk_${account}`);
    if (!storedKey) {
      alert("No scanning key found for this account. Did you register on this device?");
      return;
    }

    setScanning(true);
    setScanStatus('Preparing scan...');
    setDeposits([]);

    try {
      const currentBlock = await publicClient.getBlockNumber();
      const lastKey = `worm_last_scan_block_${account}`;
      const lastScannedRaw = localStorage.getItem(lastKey);
      const defaultWindow = 20000n; // ~ recent blocks to avoid heavy RPC queries
      let startBlock = lastScannedRaw ? BigInt(lastScannedRaw) : (currentBlock > defaultWindow ? currentBlock - defaultWindow : 0n);
      if (startBlock < 0n) startBlock = 0n;

      const chunkSizeBase = 2500n; // request in chunks to avoid RPC timeouts
      let chunkSize = chunkSizeBase;
      let fromBlock = startBlock;
      const allLogs: Array<{ args: { stealthAddress?: string; amount?: bigint; ephemeralPubKey?: string } }> = [];

      while (fromBlock < currentBlock) {
        const toBlock = (fromBlock + chunkSize) < currentBlock ? (fromBlock + chunkSize) : currentBlock;
        setScanStatus(`Scanning blocks ${fromBlock.toString()} → ${toBlock.toString()}...`);
        try {
          const logs = await publicClient.getContractEvents({
            address: COMMIT_REGISTRY_ADDRESS,
            abi: commitRegistryAbi,
            eventName: 'SupportCommitted',
            fromBlock,
            toBlock,
          });
          allLogs.push(...(logs as Array<{ args: { stealthAddress?: string; amount?: bigint; ephemeralPubKey?: string } }>));
          fromBlock = toBlock + 1n;
          // If successful for a few chunks, we can slightly increase chunk size to speed up scans
          if (chunkSize < 5000n) chunkSize += 500n;
        } catch (err) {
          // If we hit a timeout, reduce chunk size and retry next range
          console.error("Chunk scan failed, reducing range", err);
          setScanStatus(`Chunk timed out at ${fromBlock.toString()} → ${toBlock.toString()}. Reducing chunk size...`);
          chunkSize = chunkSize > 1000n ? 1000n : 500n;
          // small delay to avoid hammering RPC
          await new Promise(res => setTimeout(res, 250));
        }
      }

      setScanStatus(`Processing ${allLogs.length} events...`);
      const found: DepositItem[] = [];

      for (const log of allLogs) {
        const { stealthAddress, amount, ephemeralPubKey } = log.args;
        
        if (!stealthAddress || !amount || !ephemeralPubKey) continue;

        try {
          const { stealthAddress: derivedAddress, stealthPrivateKey } = recoverStealthPrivateKey(storedKey, ephemeralPubKey);
          
          if (derivedAddress.toLowerCase() === stealthAddress.toLowerCase()) {
            const isClaimed = await publicClient.readContract({
              address: COMMIT_REGISTRY_ADDRESS,
              abi: commitRegistryAbi,
              functionName: 'stealthClaimed',
              args: [stealthAddress as Address],
            });

            if (!isClaimed) {
               found.push({
                 stealthAddress: stealthAddress as Address,
                 amount,
                 stealthPrivateKey
               });
            }
          }
        } catch {
          // Not ours or invalid key
        }
      }

      setDeposits(found);
      setScanStatus(found.length > 0 ? `Found ${found.length} unclaimed deposits!` : 'No new deposits found.');
      // Store last scanned block slightly behind head to catch any in-flight events next time
      const resumeBlock = currentBlock > 500n ? currentBlock - 500n : currentBlock;
      localStorage.setItem(lastKey, resumeBlock.toString());
    } catch (e) {
      const dbg = process.env.NEXT_PUBLIC_DEBUG === '1';
      if (dbg) console.error("Scan failed", e);
      setScanStatus(`Scan failed: ${(e as Error).message}`);
    } finally {
      setScanning(false);
    }
  };

  const handleRedeem = async (deposit: DepositItem) => {
    const walletClient = getWalletClient();
    if (!account || !walletClient || !COMMIT_REGISTRY_ADDRESS) return;

    try {
      setRedeeming(deposit.stealthAddress);
      await ensureCorrectNetwork();

      const stealthAccount = privateKeyToAccount(deposit.stealthPrivateKey as `0x${string}`);
      const packed = encodePacked(['string', 'address'], ['Redeem WORM Funds', account]);
      const messageHash = keccak256(packed);
      
      const signature = await stealthAccount.signMessage({ 
        message: { raw: messageHash } 
      });
      const { v, r, s } = parseSignature(signature);

      const { request } = await publicClient.simulateContract({
        account,
        address: COMMIT_REGISTRY_ADDRESS,
        abi: commitRegistryAbi,
        functionName: 'redeem',
        args: [
          deposit.stealthAddress, 
          account, 
          Number(v), 
          r, 
          s
        ],
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });

      setDeposits(prev => prev.filter(d => d.stealthAddress !== deposit.stealthAddress));
      alert("Redeemed successfully!");
      try {
        const item = {
          stealthAddress: deposit.stealthAddress,
          amount: deposit.amount.toString(),
          txHash: hash,
          timestamp: Date.now(),
        };
        const key = `worm_redeemed_history_${account}`;
        const prev = localStorage.getItem(key);
        const list = prev ? JSON.parse(prev) : [];
        list.unshift(item);
        localStorage.setItem(key, JSON.stringify(list));
      } catch {}
    } catch (e) {
      const dbg = process.env.NEXT_PUBLIC_DEBUG === '1';
      if (dbg) console.error("Redeem failed", e);
      alert("Redeem failed: " + (e as Error).message);
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <header className="mb-12 flex flex-col md:flex-row justify-between items-end gap-6 border-b border-worm-green/20 pb-6">
          <div>
            <h1 className="text-4xl font-bold text-glow mb-2">Creator Dashboard</h1>
            <p className="text-text-muted">Scan for and redeem your anonymous support.</p>
          </div>
        </header>

        {/* Creator View */}
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-panel border border-worm-green/20 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <WalletIcon className="w-24 h-24 text-worm-green" />
                </div>
                <h3 className="text-text-muted text-sm uppercase tracking-wide mb-1">Unclaimed Support</h3>
                <div className="text-4xl font-bold text-white mb-2">
                  {deposits.reduce((acc, curr) => acc + Number(formatEther(curr.amount)), 0).toFixed(4)} <span className="text-lg text-worm-green">ETH</span>
                </div>
                <p className="text-xs text-text-muted">From {deposits.length} anonymous supporters</p>
              </div>

              <div className="bg-panel border border-worm-green/20 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <ShieldIcon className="w-24 h-24 text-worm-green" />
                </div>
                <h3 className="text-text-muted text-sm uppercase tracking-wide mb-1">Scan Status</h3>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-3 h-3 rounded-full ${scanning ? 'bg-yellow-400 animate-pulse' : 'bg-worm-green'}`}></div>
                  <span className="text-white font-mono text-sm">{scanning ? 'Scanning...' : 'Idle'}</span>
                </div>
                <button 
                  onClick={scanForDeposits}
                  disabled={scanning}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-worm-green flex items-center gap-2 transition-all"
                >
                  <RefreshIcon className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                  {scanning ? 'Scanning Chain...' : 'Scan for New Support'}
                </button>
              </div>
            </div>

            {/* Support List */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <ZapIcon className="text-worm-green" /> Incoming Support
              </h2>
              
              {scanStatus && (
                <div className="text-xs font-mono text-text-muted mb-4">
                  &gt; {scanStatus}
                </div>
              )}

              {deposits.length === 0 ? (
                <div className="bg-panel border border-dashed border-worm-green/20 rounded-xl p-12 text-center">
                  <p className="text-text-muted mb-4">No unclaimed support found in recent blocks.</p>
                  <button onClick={scanForDeposits} className="text-worm-green hover:underline font-bold">Run Scan</button>
                </div>
              ) : (
                <div className="bg-panel border border-worm-green/20 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-1 divide-y divide-white/5">
                    {deposits.map((deposit, i) => (
                      <div key={i} className="p-6 flex flex-col md:flex-row justify-between items-center gap-4 hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-worm-green/10 rounded-full flex items-center justify-center text-worm-green">
                            <ZapIcon />
                          </div>
                          <div>
                            <div className="font-bold text-white text-lg">{formatEther(deposit.amount)} ETH</div>
                            <div className="text-xs text-text-muted font-mono flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-worm-green"></span>
                              Unclaimed • Stealth Address: {deposit.stealthAddress.slice(0, 6)}...{deposit.stealthAddress.slice(-4)}
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleRedeem(deposit)}
                          disabled={!!redeeming}
                          className="px-6 py-2 bg-worm-green text-black font-bold rounded-lg hover:bg-success hover:shadow-[0_0_15px_rgba(58,242,107,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                          {redeeming === deposit.stealthAddress ? (
                            <span className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full"></span>
                          ) : (
                            <DownloadIcon className="w-4 h-4" />
                          )}
                          Redeem Funds
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  );
}
