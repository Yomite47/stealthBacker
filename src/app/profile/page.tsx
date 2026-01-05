'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { publicClient, getWalletClient } from '@/lib/viem';
import { COMMIT_REGISTRY_ADDRESS, commitRegistryAbi } from '@/lib/contracts';
import { Address, formatEther } from 'viem';
import { recoverStealthPrivateKey, getKeysFromSignature } from '@/lib/crypto';

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);
const UserIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const ZapIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);
const EditIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
);

type CreatorRecord = {
  name: string;
  pubKey: string;
  wallet: Address;
  registered: boolean;
};

type SupportHistoryItem = {
  amount: string;
  creatorName: string;
  creatorWallet: Address;
  txHash: string;
  timestamp: number;
};

type RedeemedHistoryItem = {
  amount: string;
  stealthAddress: Address;
  txHash: string;
  timestamp: number;
};

export default function Profile() {
  const { account } = useWallet();
  const [alias, setAlias] = useState('');
  const [aliasEditing, setAliasEditing] = useState(false);

  const [creatorInfo, setCreatorInfo] = useState<CreatorRecord | null>(null);
  const [aliasSavedMsg, setAliasSavedMsg] = useState('');

  const [supportHistory, setSupportHistory] = useState<SupportHistoryItem[]>([]);
  const [redeemedHistory, setRedeemedHistory] = useState<RedeemedHistoryItem[]>([]);
  const [unredeemed, setUnredeemed] = useState<Array<{ stealthAddress: Address; amount: bigint }>>([]);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [hasLocalKey, setHasLocalKey] = useState(false);

  const aliasKey = useMemo(() => account ? `worm_alias_${account}` : '', [account]);

  useEffect(() => {
    if (!account) return;
    try {
      const a = localStorage.getItem(aliasKey);
      if (a) setAlias(a);
    } catch {}
    
    try {
      const existing = sessionStorage.getItem(`worm_sk_${account}`);
      setHasLocalKey(!!existing);
    } catch { setHasLocalKey(false); }

    loadCreatorInfo();
    loadHistories();
    if (sessionStorage.getItem(`worm_sk_${account}`)) {
      scanUnredeemed();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const saveAlias = () => {
    if (!account) return;
    try {
      localStorage.setItem(aliasKey, alias.trim());
      setAliasSavedMsg('Saved');
      setTimeout(() => setAliasSavedMsg(''), 1500);
      setAliasEditing(false);
    } catch {}
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
      sessionStorage.setItem(`worm_sk_${account}`, keys.privateKey);
      setHasLocalKey(true);
      scanUnredeemed();
    } catch (e) {
      console.error(e);
      alert("Failed to unlock profile");
    }
  };

  const loadCreatorInfo = async () => {
    if (!COMMIT_REGISTRY_ADDRESS || !account) return;
    try {
      const list = await publicClient.readContract({
        address: COMMIT_REGISTRY_ADDRESS,
        abi: commitRegistryAbi,
        functionName: 'getAllCreators',
      }) as unknown as CreatorRecord[];
      const rec = Array.isArray(list) ? list.find(c => c.wallet.toLowerCase() === account.toLowerCase()) : undefined;
      setCreatorInfo(rec || null);
    } catch {
      setCreatorInfo(null);
    }
  };

  const loadHistories = () => {
    if (!account) return;
    try {
      const sup = localStorage.getItem(`worm_support_history_${account}`);
      setSupportHistory(sup ? JSON.parse(sup) : []);
    } catch { setSupportHistory([]); }
    try {
      const red = localStorage.getItem(`worm_redeemed_history_${account}`);
      setRedeemedHistory(red ? JSON.parse(red) : []);
    } catch { setRedeemedHistory([]); }
  };

  const scanUnredeemed = async () => {
    if (!account || !COMMIT_REGISTRY_ADDRESS) return;
    const sk = sessionStorage.getItem(`worm_sk_${account}`);
    if (!sk) return;
    setScanning(true);
    setScanStatus('Preparing scan...');
    setUnredeemed([]);
    try {
      const head = await publicClient.getBlockNumber();
      let from = head > 15000n ? head - 15000n : 0n;
      let size = 2000n;
      const found: Array<{ stealthAddress: Address; amount: bigint }> = [];
      while (from < head) {
        const to = (from + size) < head ? (from + size) : head;
        setScanStatus(`Scanning ${from.toString()} → ${to.toString()}`);
        try {
          const logs = await publicClient.getContractEvents({
            address: COMMIT_REGISTRY_ADDRESS,
            abi: commitRegistryAbi,
            eventName: 'SupportCommitted',
            fromBlock: from,
            toBlock: to,
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
                  found.push({ stealthAddress: stealthAddress as Address, amount });
                }
              }
            } catch {}
          }
          from = to + 1n;
        } catch {
          size = size > 1000n ? 1000n : 500n;
          await new Promise(r => setTimeout(r, 200));
        }
      }
      setUnredeemed(found);
      setScanStatus(found.length > 0 ? `Found ${found.length}` : 'None found');
    } finally {
      setScanning(false);
    }
  };

  if (!account) {
    return (
      <div className="min-h-screen bg-background text-text-primary p-8 flex items-center justify-center">
        <div className="bg-panel border border-worm-green/20 rounded-2xl p-8 text-center">
          <p className="text-text-muted mb-4">Connect your wallet to manage your profile.</p>
          <a href="/register" className="text-worm-green hover:underline font-bold">Become a Creator</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-worm-green/10 border border-worm-green/30 flex items-center justify-center">
              <UserIcon className="text-worm-green" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Profile</h1>
              <div className="text-text-muted font-mono">{account.slice(0,6)}...{account.slice(-4)}</div>
            </div>
          </div>
          <div className="flex gap-3">
            {aliasEditing ? (
              <>
                <input
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="Display name"
                  className="bg-black/30 border border-white/10 rounded-lg p-2 text-white focus:border-worm-green focus:outline-none"
                />
                <button onClick={saveAlias} className="px-4 py-2 bg-worm-green text-black rounded-lg font-bold hover:bg-success">Save</button>
              </>
            ) : (
              <button onClick={() => setAliasEditing(true)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-worm-green flex items-center gap-2">
                <EditIcon className="w-4 h-4" /> {alias ? 'Edit Name' : 'Set Display Name'}
              </button>
            )}
            {aliasSavedMsg && <div className="text-worm-green font-mono text-sm flex items-center">{aliasSavedMsg}</div>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-panel border border-worm-green/20 rounded-xl p-6">
            <h3 className="text-sm text-text-muted uppercase tracking-wide mb-2">Display Name</h3>
            <div className="text-2xl font-bold text-white">{alias || 'Unnamed'}</div>
          </div>
          <div className="bg-panel border border-worm-green/20 rounded-xl p-6">
            <h3 className="text-sm text-text-muted uppercase tracking-wide mb-2">Creator Status</h3>
            <div className="text-white font-bold">{creatorInfo ? 'Registered' : 'Not Registered'}</div>
            {creatorInfo && <div className="text-xs text-text-muted mt-1">Chain Name: {creatorInfo.name}</div>}
          </div>
          <div className="bg-panel border border-worm-green/20 rounded-xl p-6">
            <h3 className="text-sm text-text-muted uppercase tracking-wide mb-2">Unredeemed Support</h3>
            <div className="text-2xl font-bold text-white">{unredeemed.reduce((a,b)=>a+Number(formatEther(b.amount)),0).toFixed(4)} <span className="text-lg text-worm-green">ETH</span></div>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2"><ShieldIcon className="text-worm-green" /> Contributions</h2>
            {supportHistory.length === 0 ? (
              <div className="bg-panel border border-worm-green/20 rounded-xl p-6 text-text-muted">No local contribution history yet.</div>
            ) : (
              <div className="bg-panel border border-worm-green/20 rounded-xl overflow-hidden">
                <div className="grid grid-cols-1 divide-y divide-white/5">
                  {supportHistory.map((h, i) => (
                    <div key={i} className="p-6 flex justify-between items-center">
                      <div>
                        <div className="text-white font-bold">{h.amount} ETH</div>
                        <div className="text-xs text-text-muted font-mono">To {h.creatorName} • {h.creatorWallet.slice(0,6)}...{h.creatorWallet.slice(-4)}</div>
                      </div>
                      <a href={`https://sepolia.etherscan.io/tx/${h.txHash}`} target="_blank" className="text-worm-green text-xs hover:underline">View Tx</a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2"><ZapIcon className="text-worm-green" /> Support Received</h2>
            <div className="text-xs font-mono text-text-muted mb-2">&gt; {scanning ? 'Scanning...' : scanStatus || 'Idle'}</div>
            {!hasLocalKey ? (
               <div className="bg-panel border border-worm-green/20 rounded-xl p-8 text-center">
                 <p className="text-text-muted mb-4">Unlock your profile to scan for incoming support.</p>
                 <button onClick={handleUnlock} className="px-6 py-2 bg-worm-green text-black font-bold rounded-lg hover:bg-white transition-all">
                   Unlock to Scan
                 </button>
               </div>
            ) : unredeemed.length === 0 ? (
              <div className="bg-panel border border-worm-green/20 rounded-xl p-6 text-text-muted">No unredeemed support detected in recent blocks.</div>
            ) : (
              <div className="bg-panel border border-worm-green/20 rounded-xl overflow-hidden">
                <div className="grid grid-cols-1 divide-y divide-white/5">
                  {unredeemed.map((d, i) => (
                    <div key={i} className="p-6 flex justify-between items-center">
                      <div>
                        <div className="text-white font-bold">{formatEther(d.amount)} ETH</div>
                        <div className="text-xs text-text-muted font-mono">Stealth: {d.stealthAddress.slice(0,6)}...{d.stealthAddress.slice(-4)}</div>
                      </div>
                      <span className="text-xs text-worm-green">Unredeemed</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2"><ShieldIcon className="text-worm-green" /> Redeemed Supports</h2>
            {redeemedHistory.length === 0 ? (
              <div className="bg-panel border border-worm-green/20 rounded-xl p-6 text-text-muted">No local redeemed history yet.</div>
            ) : (
              <div className="bg-panel border border-worm-green/20 rounded-xl overflow-hidden">
                <div className="grid grid-cols-1 divide-y divide-white/5">
                  {redeemedHistory.map((h, i) => (
                    <div key={i} className="p-6 flex justify-between items-center">
                      <div>
                        <div className="text-white font-bold">{Number(formatEther(BigInt(h.amount))).toFixed(6)} ETH</div>
                        <div className="text-xs text-text-muted font-mono">Stealth: {h.stealthAddress.slice(0,6)}...{h.stealthAddress.slice(-4)}</div>
                      </div>
                      <a href={`https://sepolia.etherscan.io/tx/${h.txHash}`} target="_blank" className="text-worm-green text-xs hover:underline">View Tx</a>
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
