'use client';

import { useEffect, useState } from 'react';
import { publicClient, getWalletClient, ensureCorrectNetwork } from '@/lib/viem';
import { useWallet } from '@/context/WalletContext';
import { generateStealthAddress } from '@/lib/crypto';
import { COMMIT_REGISTRY_ADDRESS, PROOF_NFT_ADDRESS, commitRegistryAbi, proofNftAbi } from '@/lib/contracts';
import { Address, parseEther, keccak256, encodePacked } from 'viem';

// --- Icons ---
const ShieldIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);
const ZapIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);
const CheckIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"/></svg>
);
const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
);
const ExternalLinkIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
);

type Creator = {
  name: string;
  pubKey: string;
  wallet: Address;
  registered: boolean;
};

export default function Support() {
  const { account, connect } = useWallet();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [amount, setAmount] = useState('0.01');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(''); // 'generating', 'committing', 'minting', 'done'
  const [fetchError, setFetchError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [view, setView] = useState<'browse' | 'support'>('browse');
  const [loadingCreators, setLoadingCreators] = useState(false);

  useEffect(() => {
    // Load cached creators immediately for faster first paint
    try {
      const cached = localStorage.getItem('worm_creators_cache');
      if (cached) {
        const parsed = JSON.parse(cached) as { ts: number; data: Creator[] };
        if (Array.isArray(parsed?.data)) {
          setCreators(parsed.data);
        }
      }
    } catch {}
    // Refresh from chain in background
    fetchCreators();
  }, []);

  const fetchCreators = async () => {
    if (!COMMIT_REGISTRY_ADDRESS) {
      setFetchError("Contract address not configured");
      return;
    }
    try {
      setLoadingCreators(true);
      setFetchError('');
      // Primary: call view getAllCreators with timeout protection
      const readPromise = publicClient.readContract({
        address: COMMIT_REGISTRY_ADDRESS,
        abi: commitRegistryAbi,
        functionName: 'getAllCreators',
      });
      const timeoutPromise = new Promise<Creator[]>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout while fetching creators')), 8000)
      );
      let list: Creator[] | undefined;
      try {
        const data = (await Promise.race([readPromise, timeoutPromise])) as unknown as Creator[];
        if (Array.isArray(data)) {
          list = data;
        }
      } catch {
        // Fallback: reconstruct from events over recent blocks
        try {
          const currentBlock = await publicClient.getBlockNumber();
          const fromBlock = currentBlock > 50000n ? currentBlock - 50000n : 0n;
          const logs = await publicClient.getContractEvents({
            address: COMMIT_REGISTRY_ADDRESS,
            abi: commitRegistryAbi,
            eventName: 'CreatorRegistered',
            fromBlock,
          });
          const map = new Map<string, Creator>();
          for (const log of logs as Array<{ args: { wallet?: string; name?: string; pubKey?: string } }>) {
            const { wallet, name, pubKey } = log.args;
            if (!wallet || !name || !pubKey) continue;
            map.set(wallet.toLowerCase(), {
              name,
              pubKey,
              wallet: wallet as Address,
              registered: true,
            });
          }
          list = Array.from(map.values());
        } catch (e) {
          throw e;
        }
      }
      if (!list) throw new Error('Failed to load creators');
      setCreators(list);
      try {
        localStorage.setItem('worm_creators_cache', JSON.stringify({ ts: Date.now(), data: list }));
      } catch {}
    } catch (err) {
      console.error("Failed to fetch creators", err);
      setFetchError("Failed to load creators. Ensure you are on the correct network (Sepolia).");
    }
    finally {
      setLoadingCreators(false);
    }
  };

  const handleSupport = async () => {
    const walletClient = getWalletClient();
    if (!account || !selectedCreator || !walletClient || !COMMIT_REGISTRY_ADDRESS || !PROOF_NFT_ADDRESS) return;

    try {
      const dbg = process.env.NEXT_PUBLIC_DEBUG === '1';
      setLoading(true);
      setStatus('generating');
      setTxHash('');
      
      await ensureCorrectNetwork();

      // 1. Generate Stealth Address
      const { stealthAddress, ephemeralPublicKey } = generateStealthAddress(selectedCreator.pubKey);
      
      // 2. Generate Commitment Hash
      const salt = BigInt(Math.floor(Math.random() * 1000000000));
      const commitment = keccak256(encodePacked(
        ['address', 'uint256', 'uint256'],
        [stealthAddress, parseEther(amount), salt]
      ));

      if (dbg) {
        console.log("Stealth Address:", stealthAddress);
        console.log("Commitment:", commitment);
      }

      // 3. Send Support Transaction (Deposit/Burn)
      setStatus('committing');
      const { request: commitRequest } = await publicClient.simulateContract({
        account,
        address: COMMIT_REGISTRY_ADDRESS,
        abi: commitRegistryAbi,
        functionName: 'support',
        args: [stealthAddress, commitment, ephemeralPublicKey],
        value: parseEther(amount),
      });

      const commitHash = await walletClient.writeContract(commitRequest);
      await publicClient.waitForTransactionReceipt({ hash: commitHash });
      if (dbg) console.log("Committed:", commitHash);

      // 4. Mint Proof-of-Support NFT
      setStatus('minting');
      
      const metadata = {
        name: "WORM Proof of Support",
        description: `Proof of anonymous support for ${selectedCreator.name}`,
        attributes: [
          { trait_type: "Amount", value: amount + " ETH" },
          { trait_type: "Timestamp", value: Date.now() },
          { trait_type: "Commitment", value: commitment }
        ]
      };
      
      const metadataUri = `data:application/json;base64,${btoa(JSON.stringify(metadata))}`;

      const { request: mintRequest } = await publicClient.simulateContract({
        account,
        address: PROOF_NFT_ADDRESS,
        abi: proofNftAbi,
        functionName: 'mint',
        args: [selectedCreator.wallet, commitment, metadataUri],
      });

      const mintHash = await walletClient.writeContract(mintRequest);
      await publicClient.waitForTransactionReceipt({ hash: mintHash });
      
      setStatus('done');
      setTxHash(mintHash);
      setAmount('');
      try {
        const item = {
          creatorWallet: selectedCreator.wallet,
          creatorName: selectedCreator.name,
          amount,
          commitment,
          txHash: mintHash,
          timestamp: Date.now(),
        };
        const key = `worm_support_history_${account}`;
        const prev = localStorage.getItem(key);
        const list = prev ? JSON.parse(prev) : [];
        list.unshift(item);
        localStorage.setItem(key, JSON.stringify(list));
      } catch {}
    } catch (err) {
      console.error("Support failed", err);
      alert("Support failed: " + (err as Error).message);
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCreator = (creator: Creator) => {
    setSelectedCreator(creator);
    setView('support');
    setStatus('');
    setTxHash('');
  };

  const handleBack = () => {
    setView('browse');
    setSelectedCreator(null);
  };

  return (
    <div className="min-h-screen bg-background text-text-primary p-4 md:p-8">
      
      {/* --- Browse View --- */}
      {view === 'browse' && (
        <div className="max-w-6xl mx-auto space-y-12">
          <header className="text-center space-y-4 pt-8">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-glow">
              Support Someone <span className="text-worm-green">Privately</span>
            </h1>
            <p className="text-text-muted max-w-2xl mx-auto text-lg">
              Choose a creator to support. Your transaction is anonymized via stealth addresses, leaving no trace of the link between you and the recipient.
            </p>
          </header>

          {fetchError && (
            <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-4 rounded-lg text-center max-w-2xl mx-auto">
              {fetchError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loadingCreators ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="bg-panel border border-worm-green/10 rounded-xl p-6 h-64 animate-pulse flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-worm-green/10 rounded-full mb-4"></div>
                  <div className="h-4 bg-worm-green/10 rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-worm-green/5 rounded w-3/4"></div>
                </div>
              ))
            ) : creators.length === 0 ? (
              <div className="col-span-full bg-panel border border-dashed border-worm-green/20 rounded-xl p-12 text-center">
                <p className="text-text-muted mb-4">No creators registered yet.</p>
                <button onClick={fetchCreators} className="text-worm-green hover:underline font-bold">Refresh List</button>
              </div>
            ) : (
              creators.map((creator, i) => (
                <div 
                  key={i} 
                  className="group bg-panel border border-worm-green/20 rounded-xl p-6 flex flex-col items-center text-center transition-all duration-300 hover:border-worm-green hover:shadow-[0_0_20px_rgba(58,242,107,0.15)] hover:-translate-y-1"
                >
                  <div className="w-20 h-20 rounded-full bg-panel border-2 border-worm-green/30 flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(58,242,107,0.1)] group-hover:border-worm-green transition-colors">
                    <span className="text-3xl font-bold text-worm-green">{creator.name[0].toUpperCase()}</span>
                  </div>
                  
                  <h3 className="text-xl font-bold mb-1 text-white">{creator.name}</h3>
                  <p className="text-text-muted text-sm mb-6 line-clamp-2">
                    Creating content and building in the shadows.
                  </p>
                  
                  <div className="w-full space-y-3 mb-6">
                    <div className="flex justify-between items-center text-xs text-text-muted bg-black/20 p-2 rounded">
                      <span>Support Badges</span>
                      <span className="text-worm-green font-mono">12</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-text-muted bg-black/20 p-2 rounded">
                      <span>Anonymous Support</span>
                      <span className="text-worm-green flex items-center gap-1">
                        Enabled <CheckIcon className="w-3 h-3" />
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectCreator(creator)}
                    className="w-full py-3 bg-worm-green text-black font-bold rounded-lg hover:bg-success hover:shadow-[0_0_15px_rgba(58,242,107,0.6)] transition-all flex items-center justify-center gap-2"
                  >
                    <ZapIcon className="w-4 h-4" />
                    Support Anonymously
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- Support View --- */}
      {view === 'support' && selectedCreator && (
        <div className="max-w-2xl mx-auto pt-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
          <button 
            onClick={handleBack}
            className="flex items-center text-text-muted hover:text-worm-green mb-8 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            Back to Creators
          </button>

          <div className="bg-panel border border-worm-green/20 rounded-2xl p-8 relative overflow-hidden">
            {/* Top Panel */}
            <div className="flex flex-col items-center text-center mb-8 pb-8 border-b border-worm-green/10">
              <div className="w-24 h-24 rounded-full bg-panel border-2 border-worm-green flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(58,242,107,0.2)]">
                <span className="text-4xl font-bold text-worm-green">{selectedCreator.name[0].toUpperCase()}</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Support {selectedCreator.name}</h2>
              <p className="text-text-muted max-w-md">
                Send private support without revealing your wallet identity. The creator receives funds via a stealth address.
              </p>
            </div>

            {/* Action Card */}
            {!account ? (
              <div className="text-center py-8">
                <button 
                  onClick={connect}
                  className="px-8 py-3 bg-transparent border border-worm-green text-worm-green rounded-lg font-bold hover:bg-worm-green hover:text-black transition-all shadow-[0_0_10px_rgba(58,242,107,0.2)]"
                >
                  Connect Wallet to Support
                </button>
              </div>
            ) : status === 'done' ? (
              <div className="text-center py-8 space-y-6">
                <div className="w-20 h-20 bg-worm-green/20 rounded-full flex items-center justify-center mx-auto text-worm-green animate-bounce">
                  <CheckIcon className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Support Sent!</h3>
                  <p className="text-text-muted">
                    Badge minted to creator successfully.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <a 
                    href={`https://sepolia.etherscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-worm-green hover:underline flex items-center justify-center gap-2"
                  >
                    View on SepoliaScan <ExternalLinkIcon className="w-4 h-4" />
                  </a>
                  <button 
                    onClick={handleBack}
                    className="px-6 py-3 bg-panel border border-worm-green/30 rounded-lg hover:border-worm-green text-white transition-all"
                  >
                    Support Another Creator
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold mb-3 uppercase tracking-wide text-text-muted">
                    Select Amount (ETH)
                  </label>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {['0.001', '0.01', '0.1'].map((val) => (
                      <button
                        key={val}
                        onClick={() => setAmount(val)}
                        className={`py-3 rounded-lg border font-mono transition-all ${
                          amount === val 
                            ? 'bg-worm-green text-black border-worm-green font-bold shadow-[0_0_10px_rgba(58,242,107,0.4)]' 
                            : 'bg-black/30 border-white/10 text-text-muted hover:border-worm-green/50'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Custom Amount"
                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-worm-green focus:outline-none focus:ring-1 focus:ring-worm-green/50 transition-all font-mono"
                  />
                </div>

                <div className="bg-worm-green/5 border border-worm-green/10 rounded-lg p-4 flex items-start gap-3">
                  <ShieldIcon className="w-5 h-5 text-worm-green flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-text-muted leading-relaxed">
                    This transaction sends support via a <span className="text-worm-green">burn-derived address</span> on Sepolia. 
                    Your main wallet is not publicly linked to the recipient.
                  </p>
                </div>

                <button
                  onClick={handleSupport}
                  disabled={loading}
                  className="w-full py-4 bg-worm-green text-black font-bold rounded-lg hover:bg-success hover:shadow-[0_0_20px_rgba(58,242,107,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all relative overflow-hidden group"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full"></span>
                      {status === 'generating' && 'Generating Keys...'}
                      {status === 'committing' && 'Sending Funds...'}
                      {status === 'minting' && 'Minting Proof...'}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Confirm & Burn Support <ZapIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
