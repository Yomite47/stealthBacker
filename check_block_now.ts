
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://1rpc.io/sepolia'),
});

async function getBlock() {
  const block = await client.getBlockNumber();
  console.log('Current Block:', block);
}

getBlock();
