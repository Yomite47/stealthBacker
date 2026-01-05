import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, hexToBytes } from 'viem';
import { privateKeyToAddress, generatePrivateKey } from 'viem/accounts';

export const generateScanningKeys = () => {
  const privateKey = generatePrivateKey();
  const publicKey = secp256k1.getPublicKey(hexToBytes(privateKey));
  return {
    privateKey,
    publicKey: bytesToHex(publicKey),
  };
};

export const generateEphemeralKeys = () => {
  const privateKey = generatePrivateKey();
  const publicKey = secp256k1.getPublicKey(hexToBytes(privateKey));
  return {
    privateKey,
    publicKey: bytesToHex(publicKey),
  };
};

// For Supporter: Generate Stealth Address and Keys
export const generateStealthAddress = (scanningPubKeyHex: string) => {
  // 1. Generate Ephemeral Key
  const ephemeral = generateEphemeralKeys();
  
  // 2. Compute Shared Secret: ECDH(ephemeralPriv, scanningPub)
  const sharedSecretPoint = secp256k1.getSharedSecret(
    hexToBytes(ephemeral.privateKey as `0x${string}`),
    hexToBytes(scanningPubKeyHex as `0x${string}`)
  );
  
  // 3. Hash Shared Secret to get a "Stealth Seed"
  // We strip the first byte (04) if it's uncompressed, but noble returns compressed by default for shared secret?
  // sharedSecret is usually X coordinate (32 bytes).
  // const stealthSeed = keccak_256(sharedSecretPoint.slice(1)); 
  // Slice 1 to remove the 02/03 prefix if compressed? 
  // secp256k1.getSharedSecret returns a compressed point (33 bytes) by default in noble-curves v1+, 
  // but let's check documentation or just use the full byte array.
  // Actually, standard ECDH usually uses just the X coordinate.
  // Let's stick to hashing the whole returned byte array for simplicity, as long as it's consistent.
  
  // 4. Derive Stealth Private Key (This is a simplified scheme where Stealth Priv = Hash(Shared))
  // Real stealth addresses are usually P_stealth = P_scan + G * Hash(Shared).
  // But here we are using a simplified "Burn" address scheme where we just need *a* private key that the creator can recover.
  // So `StealthPriv = Keccak(SharedSecret)` is fine as long as it's a valid private key.
  const stealthPrivateKeyBytes = keccak_256(sharedSecretPoint);
  const stealthPrivateKey = bytesToHex(stealthPrivateKeyBytes);
  
  // 5. Derive Stealth Address
  const stealthAddress = privateKeyToAddress(stealthPrivateKey as `0x${string}`);
  
  return {
    stealthAddress,
    stealthPrivateKey,
    ephemeralPublicKey: ephemeral.publicKey,
  };
};

// For Creator: Recover Stealth Private Key
export const recoverStealthPrivateKey = (scanningPrivKeyHex: string, ephemeralPubKeyHex: string) => {
  // 1. Compute Shared Secret: ECDH(scanningPriv, ephemeralPub)
  const sharedSecretPoint = secp256k1.getSharedSecret(
    hexToBytes(scanningPrivKeyHex as `0x${string}`),
    hexToBytes(ephemeralPubKeyHex as `0x${string}`)
  );
  
  // 2. Recreate Stealth Private Key
  const stealthPrivateKeyBytes = keccak_256(sharedSecretPoint);
  const stealthPrivateKey = bytesToHex(stealthPrivateKeyBytes);
  
  // 3. Verify Address (Optional)
  const stealthAddress = privateKeyToAddress(stealthPrivateKey as `0x${string}`);
  
  return {
    stealthAddress,
    stealthPrivateKey,
  };
};
