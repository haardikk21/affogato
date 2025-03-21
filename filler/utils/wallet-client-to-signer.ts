import type { WalletClient } from "viem";

function walletClientToSigner(walletClient: WalletClient) {
  const { chain, account } = walletClient;
  if (typeof chain === "undefined") {
    throw new Error(`[walletClientToSigner] "chain" is undefined`);
  }
  if (typeof account === "undefined") {
    throw new Error(`[walletClientToSigner] "account" is undefined`);
  }
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const transport = walletClient.transport;
  const url = transport.url ?? chain.rpcUrls.default.http[0];
}
