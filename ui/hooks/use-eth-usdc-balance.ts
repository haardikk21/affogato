import { erc20Abi } from "viem";
import { useBalance, useReadContract } from "wagmi";
import { RollupChainMetadata } from "../../filler/config/types";

export function useEthUsdcBalance(
  address: `0x${string}` | undefined,
  chain: RollupChainMetadata
) {
  const { data: userEthBalance } = useBalance({
    address,
    chainId: chain.id,
    query: {
      refetchInterval: 1000,
    },
  });

  const { data: usdcBalance } = useReadContract({
    address: chain.usdc.address as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: chain.id,
    query: {
      refetchInterval: 1000,
    },
  });

  return {
    userEthBalance,
    usdcBalance,
  };
}
