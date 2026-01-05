export const COMMIT_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_COMMIT_REGISTRY as `0x${string}` | undefined;
export const PROOF_NFT_ADDRESS = process.env.NEXT_PUBLIC_PROOF_NFT as `0x${string}` | undefined;

// Legacy for compatibility if needed, but we should migrate
export const STEALTH_POOL_ADDRESS = COMMIT_REGISTRY_ADDRESS;

export const commitRegistryAbi = [
  {
    type: "function",
    name: "registerCreator",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "pubKey", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getAllCreators",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        components: [
          { name: "name", type: "string" },
          { name: "pubKey", type: "string" },
          { name: "wallet", type: "address" },
          { name: "registered", type: "bool" },
        ],
        type: "tuple[]",
      },
    ],
  },
  {
    type: "function",
    name: "support",
    stateMutability: "payable",
    inputs: [
      { name: "stealthAddress", type: "address" },
      { name: "commitment", type: "bytes32" },
      { name: "ephemeralPubKey", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "stealthAddress", type: "address" },
      { name: "recipient", type: "address" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isCommitted",
    stateMutability: "view",
    inputs: [{ name: "commitment", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "stealthClaimed",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "stealthDeposits",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "CreatorRegistered",
    inputs: [
      { name: "wallet", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "pubKey", type: "string", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SupportCommitted",
    inputs: [
      { name: "commitment", type: "bytes32", indexed: true },
      { name: "stealthAddress", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "ephemeralPubKey", type: "string", indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const proofNftAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "commitment", type: "bytes32" },
      { name: "uri", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

// Alias for legacy code if any remains
export const stealthPoolAbi = commitRegistryAbi;
export const creatorNftAbi = proofNftAbi;
