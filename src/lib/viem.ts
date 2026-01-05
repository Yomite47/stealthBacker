import { createWalletClient, createPublicClient, custom, http, fallback, type Address, type WalletClient } from "viem";
import { sepolia } from "viem/chains";

export const targetChain = sepolia; // Always target Sepolia for now since we are using public testnet

// Use fallback transport with multiple reliable RPCs for Sepolia
const transport = targetChain.id === sepolia.id 
  ? fallback([
      http('https://1rpc.io/sepolia'),
      http('https://ethereum-sepolia-rpc.publicnode.com'),
      http('https://sepolia.drpc.org'),
      http('https://rpc.sepolia.org')
    ])
  : http();

export const publicClient = createPublicClient({
  chain: targetChain,
  transport,
});

type EIP1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

// Lazy initialization of wallet client
let _walletClient: WalletClient | undefined;
let _provider: EIP1193Provider | undefined;

export function getWalletClient(): WalletClient | undefined {
  if (typeof window === "undefined") return undefined;
  
  if (_walletClient) return _walletClient;

  const provider = _provider ?? (window as { ethereum?: EIP1193Provider }).ethereum;
  if (!provider) return undefined;

  _walletClient = createWalletClient({
    chain: targetChain,
    transport: custom(provider),
  });

  return _walletClient;
}

// Keep the export for backward compatibility but it might be undefined initially
export const walletClient = typeof window !== "undefined" ? getWalletClient() : undefined;

export async function getAccount(request: boolean = false) {
  const client = getWalletClient();
  if (!client) return undefined;
  
  try {
    const addrs = await client.requestAddresses();
    return addrs[0];
  } catch {
    // Fallback to direct provider access if client fails (rare)
    const provider = _provider ?? (window as { ethereum?: EIP1193Provider }).ethereum;
    if (!provider) return undefined;
    const method = request ? "eth_requestAccounts" : "eth_accounts";
    try {
      const addrs = (await provider.request({ method })) as Address[];
      return addrs[0];
    } catch (err) {
      console.error("Failed to get account", err);
      return undefined;
    }
  }
}

export async function ensureCorrectNetwork() {
  const client = getWalletClient();
  if (!client) return;
  
  const chainId = await client.getChainId();
  if (chainId !== targetChain.id) {
    try {
      await client.switchChain({ id: targetChain.id });
    } catch {
      try {
        await client.addChain({ chain: targetChain });
      } catch (addError) {
        console.error("Failed to add chain", addError);
        throw addError;
      }
    }
  }
}

export function setWalletProvider(provider: EIP1193Provider | undefined) {
  _provider = provider;
  _walletClient = undefined;
}
