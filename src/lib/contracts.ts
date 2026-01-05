export const COMMIT_REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_COMMIT_REGISTRY || "0xCB6e2D5424e8242920f6dC6078BBfb4083c7C12E") as `0x${string}`;
export const PROOF_NFT_ADDRESS = (process.env.NEXT_PUBLIC_PROOF_NFT || "0xAb312caeAbAA11Ff84b52f7374E97C1B0c574CB4") as `0x${string}`;

export const PROOF_OF_SUPPORT_NFT_ADDRESS = PROOF_NFT_ADDRESS;
export const STEALTH_BURN_REGISTRY_ADDRESS = COMMIT_REGISTRY_ADDRESS;

export const proofOfSupportNftAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "commitment", type: "bytes32" },
      { name: "tokenURI", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "commitmentUsed",
    stateMutability: "view",
    inputs: [{ name: "commitment", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
];


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

export const stealthBurnRegistryAbi = commitRegistryAbi;

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
