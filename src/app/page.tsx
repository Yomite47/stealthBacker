import Link from "next/link";

// --- Icons ---
const ShieldIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);
const ZapIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col justify-center items-center p-8 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-worm-green/10 rounded-full blur-[100px] -z-10"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-worm-green/5 rounded-full blur-[100px] -z-10"></div>

      <main className="max-w-4xl w-full text-center space-y-16 relative z-10">
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-glow">
            Stealth<span className="text-worm-green">Backer</span>
          </h1>
          <p className="text-xl md:text-2xl text-text-muted max-w-2xl mx-auto leading-relaxed">
            The private patronage platform. Support creators without doxxing your wallet. 
            Creators redeem funds anonymously using <span className="text-worm-green">stealth addresses</span>.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
          
          {/* For Supporters */}
          <div className="group bg-panel p-8 rounded-3xl shadow-[0_0_30px_rgba(0,0,0,0.3)] border border-worm-green/20 hover:border-worm-green transition-all duration-300 hover:-translate-y-2 flex flex-col items-center relative overflow-hidden">
            <div className="w-16 h-16 bg-worm-green/10 rounded-full flex items-center justify-center mb-6 text-worm-green group-hover:scale-110 transition-transform">
              <ShieldIcon className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-white">For Supporters</h2>
            <p className="text-text-muted mb-8 flex-grow">
              Donate privately to registered creators. Your identity remains hidden on-chain.
            </p>
            <Link
              href="/support"
              className="w-full py-4 bg-worm-green text-black rounded-xl font-bold hover:bg-success hover:shadow-[0_0_20px_rgba(58,242,107,0.4)] transition-all flex items-center justify-center gap-2"
            >
              Support a Creator <ShieldIcon className="w-4 h-4" />
            </Link>
          </div>

          {/* For Creators */}
          <div className="group bg-panel p-8 rounded-3xl shadow-[0_0_30px_rgba(0,0,0,0.3)] border border-worm-green/20 hover:border-worm-green transition-all duration-300 hover:-translate-y-2 flex flex-col items-center relative overflow-hidden">
            <div className="w-16 h-16 bg-worm-green/10 rounded-full flex items-center justify-center mb-6 text-worm-green group-hover:scale-110 transition-transform">
              <ZapIcon className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-white">For Creators</h2>
            <p className="text-text-muted mb-8 flex-grow">
              Register a stealth profile and claim donations anonymously.
            </p>
            <div className="w-full space-y-3">
              <Link
                href="/register"
                className="block w-full py-3 bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-white/10 hover:border-worm-green transition-all"
              >
                Become a Creator
              </Link>
              <Link
                href="/dashboard"
                className="block w-full py-3 bg-transparent text-text-muted rounded-xl font-medium hover:text-worm-green transition-colors flex items-center justify-center gap-2"
              >
                Go to Dashboard &rarr;
              </Link>
            </div>
          </div>
        </div>

        <div className="pt-12 text-text-muted text-sm animate-in fade-in duration-1000 delay-500">
          <p>Running on Ethereum Sepolia Testnet</p>
          <p className="mt-2 font-mono text-xs opacity-50 text-worm-green">
            Powered by WORM Protocol & Noble Cryptography
          </p>
        </div>
      </main>
    </div>
  );
}
