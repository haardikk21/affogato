import { addressToBytes32, bytes32ToAddress } from "@hyperlane-xyz/utils";
import type { Wallet } from "ethers";
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  getContract,
  http,
  maxUint256,
  zeroAddress,
  type Account,
  type WalletClient,
  type WatchContractEventOnLogsParameter,
  type WatchContractEventReturnType,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { waitForTransactionReceipt } from "viem/actions";
import { hyperlane7683Abi } from "./abis/hyperlane7683";
import { chainsMetadata } from "./config/chainsMetadata";
import type { ChainSlug } from "./config/types";
import { log } from "./logger";

type OpenOrderLog = WatchContractEventOnLogsParameter<
  typeof hyperlane7683Abi,
  "Open",
  false
>[number];

export class Filler {
  private account: Wallet;
  private viemAccount: Account;
  private shutdownHandlers: Array<WatchContractEventReturnType> = [];
  private clients: Record<ChainSlug, WalletClient>;

  constructor(account: Wallet) {
    this.account = account;
    this.clients = {};

    this.viemAccount = privateKeyToAccount(
      this.account._signingKey().privateKey as `0x${string}`
    );

    for (const chain of chainsMetadata) {
      const walletClient = createWalletClient({
        account: this.viemAccount,
        chain,
        transport: http(),
      });

      this.clients[chain.slug] = walletClient;
    }
  }

  start() {
    for (const chain of chainsMetadata) {
      if (chain.isParentChain) continue;

      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });

      const unwatch = publicClient.watchContractEvent({
        address: chain.oif.router,
        abi: hyperlane7683Abi,
        eventName: "Open",
        onLogs: async (logs) => {
          for (const log of logs) {
            await this.fillOrder(log);
          }
        },
      });

      this.shutdownHandlers.push(unwatch);
    }
  }

  async stop() {
    for (const unwatch of this.shutdownHandlers) {
      unwatch();
    }
  }

  private async fillOrder(event: OpenOrderLog) {
    if (!event.args.orderId) return;
    if (!event.args.resolvedOrder) return;

    for (const output of event.args.resolvedOrder.maxSpent) {
      const tokenAddress = bytes32ToAddress(output.token) as `0x${string}`;
      const recipient = bytes32ToAddress(output.recipient) as `0x${string}`;
      if (tokenAddress === zeroAddress) continue;

      const destinationChainId = output.chainId;
      const destinationChain = chainsMetadata.find(
        (c) => c.id === Number(destinationChainId)
      );
      if (!destinationChain) continue;

      const client = this.clients[destinationChain.slug];
      if (!client) continue;

      const tokenContract = getContract({
        abi: erc20Abi,
        address: tokenAddress,
        client,
      });
      const allowance = await tokenContract.read.allowance([
        this.viemAccount.address,
        recipient,
      ]);

      if (allowance < output.amount) {
        const tx = await tokenContract.write.approve([recipient, maxUint256], {
          account: this.viemAccount,
          chain: destinationChain,
        });
        log.info(
          `Approved ${output.amount} ${tokenAddress} for ${recipient} on ${destinationChain.slug}`
        );
        await waitForTransactionReceipt(client, { hash: tx });
      }
    }

    for (let i = 0; i < event.args.resolvedOrder.fillInstructions.length; i++) {
      const instruction = event.args.resolvedOrder.fillInstructions[i];
      const destinationChain = chainsMetadata.find(
        (c) => c.id === Number(instruction.destinationChainId)
      );
      if (!destinationChain) continue;

      const client = this.clients[destinationChain.slug];

      const destinationSettler = getContract({
        abi: hyperlane7683Abi,
        address: bytes32ToAddress(
          instruction.destinationSettler
        ) as `0x${string}`,
        client,
      });

      const output = event.args.resolvedOrder.maxSpent[i];
      const value = output.token === zeroAddress ? output.amount : BigInt(0);

      const tx = await destinationSettler.write.fill(
        [
          event.args.orderId,
          instruction.originData,
          addressToBytes32(this.viemAccount.address) as `0x${string}`,
        ],
        {
          chain: destinationChain,
          account: this.viemAccount,
          value,
        }
      );
      log.info(
        `Filled order ${event.args.orderId} on ${destinationChain.slug}`
      );
      await waitForTransactionReceipt(client, { hash: tx });

      // settlement
      const settlementGasValue = await destinationSettler.read.quoteGasPayment([
        Number(event.args.resolvedOrder.originChainId),
      ]);
      const settleTx = await destinationSettler.write.settle(
        [[event.args.orderId]],
        {
          chain: destinationChain,
          account: this.viemAccount,
          value: settlementGasValue,
        }
      );
      log.info(
        `Settled order ${event.args.orderId} on ${destinationChain.slug}`
      );
      await waitForTransactionReceipt(client, { hash: settleTx });
    }
  }
}
