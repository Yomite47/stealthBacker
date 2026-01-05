'use client';

import { useState } from 'react';
import { getWalletClient, publicClient, ensureCorrectNetwork } from '@/lib/viem';
import { useWallet } from '@/context/WalletContext';
import { generateScanningKeys } from '@/lib/crypto';
import { COMMIT_REGISTRY_ADDRESS, commitRegistryAbi } from '@/lib/contracts';

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

export default function Register() {
  const { account } = useWallet();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState('');

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

      // 1. Generate Scanning Keys (Stealth Keys)
      if (dbg) console.log("Generating keys...");
      const keys = generateScanningKeys();
      if (dbg) console.log("Keys generated");

      // 2. Save Private Key to Local Storage
      // In a real app, this should be encrypted or handled by a wallet extension
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
    } catch (err: unknown) {
      const dbg = process.env.NEXT_PUBLIC_DEBUG === '1';
      if (dbg) console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background text-text-primary">
        <div className="max-w-md w-full bg-panel p-8 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-worm-green/20 text-center animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-worm-green/20 rounded-full flex items-center justify-center mx-auto mb-6 text-worm-green">
            <CheckIcon className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold mb-4 text-glow">Welcome, {name}!</h1>
          <p className="mb-6 text-text-muted">
            You are now registered as a Stealth Creator.
          </p>
          <div className="bg-worm-green/10 border border-worm-green/20 p-4 rounded-lg mb-8 text-sm text-text-primary flex items-start gap-3 text-left">
            <KeyIcon className="w-5 h-5 text-worm-green flex-shrink-0 mt-0.5" />
            <span>Your scanning key has been generated and saved to this browser. You can now receive private support.</span>
          </div>
          <a
            href="/dashboard"
            className="inline-block w-full py-3 px-6 bg-worm-green text-black rounded-lg font-bold hover:bg-success hover:shadow-[0_0_15px_rgba(58,242,107,0.5)] transition-all"
          >
            Go to Dashboard
          </a>
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
