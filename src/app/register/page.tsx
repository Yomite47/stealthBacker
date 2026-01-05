'use client';

import { useEffect, useState } from 'react';
import { getWalletClient, publicClient, ensureCorrectNetwork } from '@/lib/viem';
import { useWallet } from '@/context/WalletContext';
import { getKeysFromSignature, recoverStealthPrivateKey } from '@/lib/crypto';
import { COMMIT_REGISTRY_ADDRESS, commitRegistryAbi } from '@/lib/contracts';
import { Address, formatEther } from 'viem';

// --- Icons ---
const UserIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const CheckIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"/></svg>
);
const KeyIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
);
const TrashIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
);
const WarningIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);

export default function Register() {
  const { account } = useWallet();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState('');
  const [hasLocalKey, setHasLocalKey] = useState(false);
  
  // Deletion Logic State
  const [deleting, setDeleting] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [unclaimedAmount, setUnclaimedAmount] = useState<bigint>(0n);
  const [unclaimedCount, setUnclaimedCount] = useState(0);

  useEffect(() => {
    const check = async () => {
      if (!account || !COMMIT_REGISTRY_ADDRESS) return;
      try {
        const list = await publicClient.readContract({
          address: COMMIT_REGISTRY_ADDRESS,
          abi: commitRegistryAbi,
          functionName: 'getAllCreators',
        }) as unknown as Array<{ wallet: `0x${string}`; name: string }>;
        const rec = Array.isArray(list) ? list.find(c => c.wallet.toLowerCase() === account.toLowerCase()) : undefined;
        if (rec) {
          setRegistered(true);
          setName(rec.name || '');
        } else {
          setRegistered(false);
        }
      } catch {
        setRegistered(false);
      }
      try {
        const existing = localStorage.getItem(`worm_sk_${account}`);
        setHasLocalKey(!!existing);
      } catch {
        setHasLocalKey(false);
      }
    };
    check();
  }, [account]);

  const handleRegister = async () => {
    const walletClient = getWalletClient();
    if (!name || !account || !walletClient || !COMMIT_REGISTRY_ADDRESS) return;

    try {
      const dbg = process.env.NEXT_PUBLIC_DEBUG === '1';
      setLoading(true);
      setError('');
      
      if (dbg) console.log("Ensuring correct network...");
      await ensureCorrectNetwork();
      if (dbg) console.log("Network correct.");

      // 1. Sign Message to Derive Keys (Deterministic)
      if (dbg) console.log("Requesting signature...");
      const signature = await walletClient.signMessage({
        account,
        message: `Sign this message to access your StealthBacker profile.\n\nThis signature is used to securely generate your scanning keys on this device without you needing to manage them manually.\n\nAccount: ${account}`
      });
      
      const keys = getKeysFromSignature(signature);
      if (dbg) console.log("Keys derived");

      // 2. Save Private Key to Local Storage (Auto-login for next time)
      localStorage.setItem(`worm_sk_${account}`, keys.privateKey);

      // 3. Register Public Key on Chain
      if (dbg) console.log("Simulating contract...");
      
      const { request } = await publicClient.simulateContract({
        account,
        address: COMMIT_REGISTRY_ADDRESS,
        abi: commitRegistryAbi,
        functionName: 'registerCreator',
        args: [name, keys.publicKey],
      });
      if (dbg) console.log("Simulation successful");

      const hash = await walletClient.writeContract(request);
      if (dbg) console.log("Transaction sent");
      
      await publicClient.waitForTransactionReceipt({ hash });
      if (dbg) console.log("Transaction confirmed");

      setRegistered(true);
      setHasLocalKey(true); // Immediate update
    } catch (err: unknown) {
      const dbg = process.env.NEXT_PUBLIC_DEBUG === '1';
      if (dbg) console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    const walletClient = getWalletClient();
    if (!account || !walletClient) return;
    try {
      const signature = await walletClient.signMessage({
        account,
        message: `Sign this message to access your StealthBacker profile.\n\nThis signature is used to securely generate your scanning keys on this device without you needing to manage them manually.\n\nAccount: ${account}`
      });
      const keys = getKeysFromSignature(signature);
      localStorage.setItem(`worm_sk_${account}`, keys.privateKey);
      setHasLocalKey(true);
    } catch (e) {
      console.error(e);
      alert("Failed to unlock profile");
    }
  };

  const handleDeleteProfile = async () => {
    if (!account || !COMMIT_REGISTRY_ADDRESS) return;
    
    // Check for local key first
    const sk = localStorage.getItem(`worm_sk_${account}`);
    if (!sk) {
      setUnclaimedCount(0);
      setUnclaimedAmount(0n);
      setShowDeleteConfirm(true);
      return;
    }

    setDeleting(true);
    setScanStatus('Checking for unclaimed items...');
    setUnclaimedCount(0);
    setUnclaimedAmount(0n);

    try {
      const currentBlock = await publicClient.getBlockNumber();
      // Scan last 50k blocks (~1 week) for speed. Deep scan recommended on Dashboard.
      let fromBlock = currentBlock > 50000n ? currentBlock - 50000n : 0n;
      let size = 5000n;
      let foundCount = 0;
      let foundAmount = 0n;

      while (fromBlock < currentBlock) {
        const toBlock = (fromBlock + size) < currentBlock ? (fromBlock + size) : currentBlock;
        setScanStatus(`Scanning blocks ${fromBlock.toString()} → ${toBlock.toString()}...`);
        
        try {
          const logs = await publicClient.getContractEvents({
            address: COMMIT_REGISTRY_ADDRESS,
            abi: commitRegistryAbi,
            eventName: 'SupportCommitted',
            fromBlock,
            toBlock,
          });

          for (const log of logs as Array<{ args: { stealthAddress?: string; amount?: bigint; ephemeralPubKey?: string } }>) {
             const { stealthAddress, amount, ephemeralPubKey } = log.args;
             if (!stealthAddress || !amount || !ephemeralPubKey) continue;
             
             try {
                const { stealthAddress: derived } = recoverStealthPrivateKey(sk, ephemeralPubKey);
                if (derived.toLowerCase() === stealthAddress.toLowerCase()) {
                   const claimed = await publicClient.readContract({
                     address: COMMIT_REGISTRY_ADDRESS,
                     abi: commitRegistryAbi,
                     functionName: 'stealthClaimed',
                     args: [stealthAddress as Address],
                   });
                   if (!claimed) {
                     foundCount++;
                     foundAmount += BigInt(amount);
                   }
                }
             } catch {}
          }
          fromBlock = toBlock + 1n;
        } catch {
          size = 1000n;
          await new Promise(r => setTimeout(r, 200));
        }
      }
      
      setUnclaimedCount(foundCount);
      setUnclaimedAmount(foundAmount);
      setShowDeleteConfirm(true);

    } catch (e) {
      console.error(e);
      alert("Scan failed. Please check your Dashboard manually before deleting.");
    } finally {
      setDeleting(false);
    }
  };

  const performDelete = () => {
    if (!account) return;
    localStorage.removeItem(`worm_sk_${account}`);
    localStorage.removeItem(`worm_alias_${account}`);
    localStorage.removeItem(`worm_last_scan_block_${account}`);
    setHasLocalKey(false);
    setShowDeleteConfirm(false);
  };

  if (registered) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background text-text-primary">
        <div className="max-w-md w-full bg-panel p-8 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-worm-green/20 text-center animate-in fade-in zoom-in duration-500 relative">
          
          {/* Profile Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-worm-green/20 to-black rounded-full flex items-center justify-center mb-4 border-2 border-worm-green/30 shadow-[0_0_15px_rgba(58,242,107,0.2)]">
              <UserIcon className="w-10 h-10 text-worm-green" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">{name}</h1>
            <div className="text-xs font-mono text-text-muted bg-black/40 px-3 py-1 rounded-full border border-white/5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-worm-green animate-pulse"></div>
              {account?.slice(0, 8)}...{account?.slice(-6)}
            </div>
          </div>

          {/* Status Card */}
          <div className="bg-black/20 rounded-xl p-4 mb-8 border border-white/5">
             <div className="flex items-center justify-between mb-2">
               <span className="text-sm text-text-muted">Status</span>
               <span className="text-xs bg-worm-green/20 text-worm-green px-2 py-0.5 rounded border border-worm-green/20">Active Creator</span>
             </div>
             <div className="flex items-center justify-between">
               <span className="text-sm text-text-muted">Profile Access</span>
               {hasLocalKey ? (
                 <span className="text-xs text-green-400 flex items-center gap-1">
                   <CheckIcon className="w-3 h-3" /> Unlocked
                 </span>
               ) : (
                 <span className="text-xs text-yellow-400 flex items-center gap-1">
                   Locked
                 </span>
               )}
             </div>
          </div>

          {hasLocalKey ? (
            <div className="space-y-4">
              <a
                href="/dashboard"
                className="block w-full py-3 px-6 bg-worm-green text-black rounded-lg font-bold hover:bg-success hover:shadow-[0_0_15px_rgba(58,242,107,0.5)] transition-all"
              >
                Go to Dashboard
              </a>
              <button
                onClick={handleDeleteProfile}
                disabled={deleting}
                className="block w-full py-3 px-6 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg font-bold hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <span className="animate-spin w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full"></span>
                    {scanStatus || 'Scanning...'}
                  </>
                ) : (
                  <>
                    <TrashIcon className="w-4 h-4" />
                    Logout / Clear Session
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button 
                onClick={handleUnlock}
                className="w-full py-3 px-6 bg-worm-green text-black font-bold rounded-lg transition-all flex items-center justify-center gap-2 hover:bg-success hover:shadow-[0_0_20px_rgba(58,242,107,0.4)]"
              >
                <KeyIcon className="w-4 h-4" />
                Unlock with Wallet
              </button>
              <p className="text-xs text-text-muted">
                Sign a message with your wallet to verify ownership and unlock your profile.
              </p>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/90 backdrop-blur-sm rounded-2xl p-6 animate-in fade-in duration-200">
              <div className="w-full space-y-4">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500">
                  <WarningIcon className="w-8 h-8" />
                </div>
                
                {unclaimedCount > 0 ? (
                  <>
                    <h3 className="text-xl font-bold text-white">Unclaimed Items Found!</h3>
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-left">
                      <p className="text-sm text-red-200 mb-2">
                        You have <span className="font-bold text-white">{unclaimedCount} unredeemed supports</span> totaling <span className="font-bold text-white">{formatEther(unclaimedAmount)} ETH</span>.
                      </p>
                      <p className="text-xs text-red-300">
                        If you delete your profile now without backing up your key, <span className="font-bold underline">YOU WILL LOSE THESE FUNDS FOREVER.</span>
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-bold text-white">Delete Profile?</h3>
                    <p className="text-sm text-text-muted">
                      This will remove your scanning key from this device. You won&apos;t be able to see or redeem supports until you re-import your key.
                    </p>
                  </>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={performDelete}
                    className="py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-colors"
                  >
                    {unclaimedCount > 0 ? 'Delete Anyway' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background text-text-primary">
      <div className="max-w-md w-full bg-panel p-8 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-worm-green/20">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-worm-green/10 rounded-full flex items-center justify-center mx-auto mb-4 text-worm-green">
            <UserIcon className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold mb-2 text-glow">Become a Creator</h1>
          <p className="text-text-muted">
            Register to receive private support via WORM protocol.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold mb-2 uppercase tracking-wide text-text-muted">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Satoshi Nakamoto"
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-worm-green focus:outline-none focus:ring-1 focus:ring-worm-green/50 transition-all placeholder:text-white/20"
            />
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-4 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={!name || loading}
            className="w-full py-4 bg-worm-green text-black font-bold rounded-lg hover:bg-success hover:shadow-[0_0_15px_rgba(58,242,107,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all relative overflow-hidden group"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full"></span>
                Registering...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Register Profile
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
