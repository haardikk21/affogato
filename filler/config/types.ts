import type { ArbitrumNetwork } from "@arbitrum/sdk";

export type ChainSlug = (typeof chainsMetadata)[number]["slug"];

export type BaseChainMetadata = {
  id: number;
  name: string;
  slug: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: {
    default: {
      http: [string, ...string[]];
    };
  };
  blockExplorers?: {
    default: {
      name: string;
      url: string;
      apiUrl: string;
    };
  };
  usdc: {
    name: string;
    symbol: string;
    decimals: number;
    address: string;
  };
  hyperlane: {
    domainId: number;
    mailbox: string;
  };
};

export type ParentChainMetadata = BaseChainMetadata & {
  isParentChain: true;
};

export type RollupChainMetadata = BaseChainMetadata &
  ArbitrumNetwork & {
    isParentChain: false;
    oif: {
      router: string;
    };
  };

export type ChainMetadata = ParentChainMetadata | RollupChainMetadata;

export function isRollupChain(
  chain: ChainMetadata
): chain is RollupChainMetadata {
  return !chain.isParentChain;
}
