import {
  ChildTransactionReceipt,
  Erc20Bridger,
  EthBridger,
  ParentContractCallTransactionReceipt,
  ParentEthDepositTransactionReceipt,
  registerCustomArbitrumNetwork,
} from "@arbitrum/sdk";
import {
  BigNumber,
  type BigNumberish,
  Contract,
  providers,
  type Signer,
  Wallet,
} from "ethers";
import { erc20Abi } from "./abis/erc20";
import { chainsMetadata } from "./config/chainsMetadata";
import { isRollupChain, type ChainSlug } from "./config/types";
import { log } from "./logger";
import { NonceManager } from "@ethersproject/experimental";
import { formatEther, formatUnits } from "ethers/lib/utils";

export class Rebalancer {
  private account: Wallet;
  private clients: Record<ChainSlug, Signer>;

  constructor(account: Wallet) {
    this.account = account;

    // @ts-expect-error
    this.clients = {};

    for (const chain of chainsMetadata) {
      if (!chain.isParentChain) {
        registerCustomArbitrumNetwork(chain, {
          throwIfAlreadyRegistered: false,
        });
      }

      const provider = new providers.JsonRpcProvider(
        chain.rpcUrls.default.http[0]
      );
      const client = new Wallet(this.account.privateKey, provider);
      const nonceManagedClient = new NonceManager(client);
      this.clients[chain.slug] = nonceManagedClient;
    }
  }

  async getBalances(): Promise<
    Record<ChainSlug, { ethBalance: BigNumber; usdcBalance: BigNumber }>
  > {
    const result: Partial<
      Record<ChainSlug, { ethBalance: BigNumber; usdcBalance: BigNumber }>
    > = {};

    for (const chain of chainsMetadata) {
      const client = this.clients[chain.slug];

      if (!client) {
        log.warn(`No public client found for chain ${chain.name}`);
        continue;
      }

      const ethBalance = await client.getBalance("latest");
      const usdcBalance = await this.getErc20Balance(
        client,
        chain.usdc.address
      );

      result[chain.slug] = {
        ethBalance,
        usdcBalance,
      };

      log.info(
        `${chain.name}: ${formatEther(ethBalance)} ETH, ${formatUnits(
          usdcBalance,
          6
        )} USDC`
      );
    }

    return result as Record<
      ChainSlug,
      { ethBalance: BigNumber; usdcBalance: BigNumber }
    >;
  }

  async rebalanceFunds() {
    const balances = await this.getBalances();

    const totalEthBalance = Object.values(balances).reduce(
      (acc, balance) => acc.add(balance.ethBalance),
      BigNumber.from(0)
    );

    const totalUsdcBalance = Object.values(balances).reduce(
      (acc, balance) => acc.add(balance.usdcBalance),
      BigNumber.from(0)
    );

    type RebalanceStep = {
      fromChainSlug: ChainSlug;
      toChainSlug: ChainSlug;
      amount: BigNumber;
      token: "eth" | "usdc";
    };

    const ethBalancePerChain = totalEthBalance.div(chainsMetadata.length);
    const usdcBalancePerChain = totalUsdcBalance.div(chainsMetadata.length);

    const steps: RebalanceStep[] = [];

    // First handle ETH rebalancing
    for (const chain of chainsMetadata) {
      const currentBalance = balances[chain.slug].ethBalance;
      const diff = currentBalance.sub(ethBalancePerChain);

      // If this chain has excess ETH
      if (diff.gt(0)) {
        // Find chains that need ETH
        for (const targetChain of chainsMetadata) {
          if (targetChain.slug === chain.slug) continue;

          const targetBalance = balances[targetChain.slug].ethBalance;
          const targetDiff = ethBalancePerChain.sub(targetBalance);

          // If target chain needs ETH
          if (targetDiff.gt(0)) {
            const amountToMove = diff.gt(targetDiff) ? targetDiff : diff;

            // Skip if amount is too small to be worth moving
            if (amountToMove.lt(BigNumber.from("100000"))) continue;

            steps.push({
              fromChainSlug: chain.slug,
              toChainSlug: targetChain.slug,
              amount: amountToMove,
              token: "eth",
            });

            // Update balances to reflect this planned move
            balances[chain.slug].ethBalance =
              balances[chain.slug].ethBalance.sub(amountToMove);
            balances[targetChain.slug].ethBalance =
              balances[targetChain.slug].ethBalance.add(amountToMove);
          }
        }
      }
    }

    // Then handle USDC rebalancing
    for (const chain of chainsMetadata) {
      const currentBalance = balances[chain.slug].usdcBalance;
      const diff = currentBalance.sub(usdcBalancePerChain);

      // If this chain has excess USDC
      if (diff.gt(0)) {
        // Find chains that need USDC
        for (const targetChain of chainsMetadata) {
          if (targetChain.slug === chain.slug) continue;

          const targetBalance = balances[targetChain.slug].usdcBalance;
          const targetDiff = usdcBalancePerChain.sub(targetBalance);

          // If target chain needs USDC
          if (targetDiff.gt(0)) {
            const amountToMove = diff.gt(targetDiff) ? targetDiff : diff;

            // Skip if amount is too small to be worth moving
            if (amountToMove.lt(BigNumber.from("100000"))) continue;

            steps.push({
              fromChainSlug: chain.slug,
              toChainSlug: targetChain.slug,
              amount: amountToMove,
              token: "usdc",
            });

            // Update balances to reflect this planned move
            balances[chain.slug].usdcBalance =
              balances[chain.slug].usdcBalance.sub(amountToMove);
            balances[targetChain.slug].usdcBalance =
              balances[targetChain.slug].usdcBalance.add(amountToMove);
          }
        }
      }
    }

    // Execute all the rebalancing steps in parallel

    const waitForReceiptsPromises: Promise<void>[] = [];
    for (const step of steps) {
      log.info(
        `Moving ${step.amount.toString()} ${step.token.toUpperCase()} from ${
          step.fromChainSlug
        } to ${step.toChainSlug}`
      );

      //   If neither chain is L1 (arbsep), we need to route through L1
      if (step.fromChainSlug !== "arbsep" && step.toChainSlug !== "arbsep") {
        log.info(
          `L2-to-L2 transfer detected, routing through L1 (Arbitrum Sepolia)`
        );

        if (step.token === "eth") {
          // First bridge from source L2 to L1
          const waitForL2ToL1Bridge = await this.bridgeEthL2ToL1(
            step.fromChainSlug,
            step.amount
          );
          if (!waitForL2ToL1Bridge) continue;

          waitForReceiptsPromises.push(
            waitForL2ToL1Bridge().then(() => {
              this.bridgeEthL1ToL2(step.toChainSlug, step.amount).then(
                (waitForL1ToL2Bridge) => {
                  if (!waitForL1ToL2Bridge) return;
                  return waitForL1ToL2Bridge();
                }
              );
            })
          );
        } else if (step.token === "usdc") {
          // First bridge from source L2 to L1
          const waitForL2ToL1Bridge = await this.bridgeUsdcL2ToL1(
            step.fromChainSlug,
            step.amount
          );
          if (!waitForL2ToL1Bridge) continue;

          waitForReceiptsPromises.push(
            waitForL2ToL1Bridge().then(() => {
              // Then bridge from L1 to destination L2
              this.bridgeUsdcL1ToL2(step.toChainSlug, step.amount).then(
                (waitForL1ToL2Bridge) => {
                  if (!waitForL1ToL2Bridge) return;
                  return waitForL1ToL2Bridge();
                }
              );
            })
          );
        }
      }

      // Handle direct L1<->L2 transfers
      if (step.token === "eth") {
        if (step.fromChainSlug === "arbsep") {
          const wait = await this.bridgeEthL1ToL2(
            step.toChainSlug,
            step.amount
          );
          if (wait) {
            waitForReceiptsPromises.push(wait());
          }
        } else if (step.toChainSlug === "arbsep") {
          const wait = await this.bridgeEthL2ToL1(
            step.fromChainSlug,
            step.amount
          );
          if (wait) {
            waitForReceiptsPromises.push(wait());
          }
        }
      } else if (step.token === "usdc") {
        if (step.fromChainSlug === "arbsep") {
          const wait = await this.bridgeUsdcL1ToL2(
            step.toChainSlug,
            step.amount
          );
          if (wait) {
            waitForReceiptsPromises.push(wait());
          }
        } else if (step.toChainSlug === "arbsep") {
          const wait = await this.bridgeUsdcL2ToL1(
            step.fromChainSlug,
            step.amount
          );
          if (wait) {
            waitForReceiptsPromises.push(wait());
          }
        }
      }
    }

    await Promise.allSettled(waitForReceiptsPromises);

    return steps;
  }

  private async bridgeEthL1ToL2(toChainSlug: ChainSlug, amount: BigNumberish) {
    const fromChain = chainsMetadata[0];
    const toChain = chainsMetadata.find((c) => c.slug === toChainSlug);
    if (!toChain || !isRollupChain(toChain)) {
      log.error(`Chain ${toChainSlug} not found or not a rollup`);
      return;
    }

    log.info(`Bridging ETH from L1 to L2 on ${toChain.name}`);

    const fromSigner = this.clients[fromChain.slug];
    const toProvider = this.clients[toChain.slug].provider!;
    const ethBridger = new EthBridger(toChain);

    const depositTx = await ethBridger.deposit({
      amount: BigNumber.from(amount),
      parentSigner: fromSigner,
    });

    const depositReceipt = await depositTx.wait();
    log.info(
      `Deposit transaction sent on ${toChain.name}. Will take 15-20 minutes to complete on child chain`
    );

    return () => this.waitForParentToChildReceipt(depositReceipt, toProvider);
  }

  private async bridgeEthL2ToL1(
    fromChainSlug: ChainSlug,
    amount: BigNumberish
  ) {
    const toChain = chainsMetadata[0];
    const fromChain = chainsMetadata.find((c) => c.slug === fromChainSlug);
    if (!fromChain || !isRollupChain(fromChain)) {
      log.error(`Chain ${fromChainSlug} not found or not a rollup`);
      return;
    }

    log.info(`Bridging ETH from L2 to L1 on ${fromChain.name}`);

    const fromSigner = this.clients[fromChain.slug];
    const toSigner = this.clients[toChain.slug];
    const ethBridger = new EthBridger(fromChain);

    const withdrawTx = await ethBridger.withdraw({
      amount: BigNumber.from(amount),
      childSigner: fromSigner,
      destinationAddress: this.account.address,
      from: this.account.address,
    });

    const withdrawReceipt = await withdrawTx.wait();
    log.info(
      `Withdrawal transaction sent on ${fromChain.name}. Will take 10-15 minutes to complete on parent chain`
    );

    return () =>
      this.waitForChildToParentReceiptAndExecuteOutboxMessage(
        withdrawReceipt,
        toSigner,
        fromSigner.provider!
      );
  }

  private async bridgeUsdcL2ToL1(
    fromChainSlug: ChainSlug,
    amount: BigNumberish
  ) {
    const toChain = chainsMetadata[0];
    const fromChain = chainsMetadata.find((c) => c.slug === fromChainSlug);
    if (!fromChain || !isRollupChain(fromChain)) {
      log.error(`Chain ${fromChainSlug} not found or not a rollup`);
      return;
    }

    log.info(`Bridging USDC from L2 to L1 on ${fromChain.name}`);

    const fromSigner = this.clients[fromChain.slug];
    const toSigner = this.clients[toChain.slug];
    const erc20Bridger = new Erc20Bridger(fromChain);

    const withdrawTx = await erc20Bridger.withdraw({
      amount: BigNumber.from(amount),
      childSigner: fromSigner,
      destinationAddress: this.account.address,
      erc20ParentAddress: toChain.usdc.address,
    });

    const withdrawReceipt = await withdrawTx.wait();
    log.info(
      `Withdrawal transaction sent on ${fromChain.name}. Will take 10-15 minutes to complete on parent chain`
    );

    return () =>
      this.waitForChildToParentReceiptAndExecuteOutboxMessage(
        withdrawReceipt,
        toSigner,
        fromSigner.provider!
      );
  }

  private async bridgeUsdcL1ToL2(toChainSlug: ChainSlug, amount: BigNumberish) {
    const fromChain = chainsMetadata[0];
    const toChain = chainsMetadata.find((c) => c.slug === toChainSlug);
    if (!toChain || !isRollupChain(toChain)) {
      log.error(`Chain ${toChainSlug} not found or not a rollup`);
      return;
    }

    log.info(`Bridging USDC from L1 to L2 on ${toChain.name}`);
    await this.approveUSDCBridgeL1ToL2(toChainSlug, amount);

    const fromSigner = this.clients[fromChain.slug];
    const toProvider = this.clients[toChain.slug].provider!;
    const erc20Bridger = new Erc20Bridger(toChain);
    const l1UsdcAddress = fromChain.usdc.address;

    const depositTx = await erc20Bridger.deposit({
      amount: BigNumber.from(amount),
      erc20ParentAddress: l1UsdcAddress,
      parentSigner: fromSigner,
      childProvider: toProvider,
    });

    const depositReceipt = await depositTx.wait();
    return () => this.waitForParentToChildReceipt(depositReceipt, toProvider);
  }

  private async waitForParentToChildReceipt(
    receipt:
      | ParentEthDepositTransactionReceipt
      | ParentContractCallTransactionReceipt,
    childProvider: providers.Provider
  ) {
    const l2Result = await receipt.waitForChildTransactionReceipt(
      childProvider,
      1,
      20 * 60 * 1000
    );
    if (l2Result.complete) {
      log.info("L2 message successful");
    } else {
      log.error("L2 message failed");
    }
  }

  private async waitForChildToParentReceiptAndExecuteOutboxMessage(
    receipt: ChildTransactionReceipt,
    parentSigner: Signer,
    childProvider: providers.Provider
  ) {
    const withdrawEventsData = await receipt.getChildToParentMessages(
      parentSigner
    );
    const childToParentMessage = withdrawEventsData[0];

    log.info(`Waiting until message is ready to execute on parent chain...`);
    const timeStart = Date.now();
    await childToParentMessage.waitUntilReadyToExecute(
      childProvider,
      60 * 1000
    );
    const timeEnd = Date.now();
    log.info(
      `Message ready to execute on parent chain in ${timeEnd - timeStart}ms`
    );

    const executeTransaction = await childToParentMessage.execute(
      childProvider
    );
    await executeTransaction.wait();
    log.info(`Message executed on parent chain`);
  }

  private async getErc20Balance(
    client: Signer,
    tokenAddress: string
  ): Promise<BigNumber> {
    const contract = new Contract(tokenAddress, erc20Abi, client);
    const balance = await contract.balanceOf(this.account.address);
    return balance;
  }

  private async getErc20Allowance(
    client: Signer,
    tokenAddress: string,
    spenderAddress: string
  ): Promise<BigNumber> {
    const contract = new Contract(tokenAddress, erc20Abi, client);
    const allowance = await contract.allowance(
      this.account.address,
      spenderAddress
    );
    return allowance;
  }

  private async approveUSDCBridgeL1ToL2(
    toChainSlug: ChainSlug,
    amount: BigNumberish
  ) {
    const fromChain = chainsMetadata[0];

    const toChain = chainsMetadata.find((c) => c.slug === toChainSlug);
    if (!toChain || !isRollupChain(toChain)) {
      log.error(`Chain ${toChainSlug} not found or not a rollup`);
      return;
    }

    const fromSigner = this.clients[fromChain.slug];

    const erc20Bridger = new Erc20Bridger(toChain);
    const l1UsdcAddress = fromChain.usdc.address;

    const gatewayAddress = await erc20Bridger.getParentGatewayAddress(
      l1UsdcAddress,
      fromSigner.provider!
    );

    const allowance = await this.getErc20Allowance(
      fromSigner,
      l1UsdcAddress,
      gatewayAddress
    );

    if (allowance.gte(amount)) {
      log.info(`USDC already approved for ${toChain.name}`);
      return;
    }

    const approvalTx = await erc20Bridger.approveToken({
      erc20ParentAddress: l1UsdcAddress,
      parentSigner: fromSigner,
    });

    await approvalTx.wait();
    log.info(
      `Max Approved USDC spend on ${fromChain.name} to Gateway for ${toChain.name}`
    );
  }
}
