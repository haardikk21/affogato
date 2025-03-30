"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { encodeOrder, OrderData } from "@/lib/order-encoder";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CheckIcon, ChevronDownIcon, LoaderIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  createPublicClient,
  erc20Abi,
  formatEther,
  formatUnits,
  http,
  maxUint256,
  parseEther,
  parseEventLogs,
  parseUnits,
  zeroAddress,
} from "viem";
import { readContract, waitForTransactionReceipt } from "viem/actions";
import {
  useAccount,
  useSwitchChain,
  useWalletClient,
  useWriteContract,
} from "wagmi";
import { hyperlane7683Abi } from "../../filler/abis/hyperlane7683";
import { chainsMetadata } from "../../filler/config/chainsMetadata";
import { ChainSlug } from "../../filler/config/types";
import { ChainSelector } from "./chain-selector";
import { TokenSelector } from "./token-selector";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

const ORDER_DATA_TYPE_HASH =
  "0x08d75650babf4de09c9273d48ef647876057ed91d4323f8a2e3ebc2cd8a63b5e";

export function SwapWidget() {
  const { switchChain } = useSwitchChain();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  const [fromChain, setFromChain] = useState<ChainSlug>("tall");
  const [toChain, setToChain] = useState<ChainSlug>("grande");
  const [fromToken, setFromToken] = useState("ETH");
  const [toToken, setToToken] = useState("USDC");
  const [inputAmount, setInputAmount] = useState(0);
  const [receiveAmount, setReceiveAmount] = useState(0);
  const [feeCharged, setFeeCharged] = useState("");

  const [showProgressModal, setShowProgressModal] = useState(false);
  const [orderCreationTxHash, setOrderCreationTxHash] = useState("");
  const [orderFulfillmentTxHash, setOrderFulfillmentTxHash] = useState("");
  const [orderSettlementTxHash, setOrderSettlementTxHash] = useState("");
  const [relayedSettlementTxHash, setRelayedSettlementTxHash] = useState("");

  function estimateSwap() {
    const fee = 0.001;
    const maxFeeETH = parseEther("0.01");
    const maxFeeUSDC = parseUnits("1", 6);

    let feeUnits = BigInt(0);
    let inputAmountUnits = BigInt(0);
    let outputAmountUnits = BigInt(0);
    if (fromToken === "ETH") {
      inputAmountUnits = parseEther(inputAmount.toString());

      if (toToken === "ETH") {
        console.log({ inputAmountUnits });
        feeUnits = BigInt(Number(inputAmountUnits) * fee);
        if (feeUnits > maxFeeETH) {
          feeUnits = maxFeeETH;
        }
        outputAmountUnits = inputAmountUnits - feeUnits;
      } else if (toToken === "USDC") {
        const baseOutputAmountUnits =
          (inputAmountUnits * BigInt(2)) / BigInt(10 ** 12);
        console.log({ baseOutputAmountUnits });
        feeUnits = BigInt(Number(baseOutputAmountUnits) * fee);
        if (feeUnits > maxFeeUSDC) {
          feeUnits = maxFeeUSDC;
        }
        outputAmountUnits = baseOutputAmountUnits - feeUnits;
      }
    } else if (fromToken === "USDC") {
      inputAmountUnits = parseUnits(inputAmount.toString(), 6);

      if (toToken === "ETH") {
        const baseOutputAmountUnits =
          (inputAmountUnits * BigInt(10 ** 12)) / BigInt(2);
        feeUnits = BigInt(Number(baseOutputAmountUnits) * fee);
        if (feeUnits > maxFeeETH) {
          feeUnits = maxFeeETH;
        }
        outputAmountUnits = baseOutputAmountUnits - feeUnits;
      } else if (toToken === "USDC") {
        feeUnits = BigInt(Number(inputAmountUnits) * fee);
        if (feeUnits > maxFeeUSDC) {
          feeUnits = maxFeeUSDC;
        }
        outputAmountUnits = inputAmountUnits - feeUnits;
      }
    }

    if (toToken === "ETH") {
      setReceiveAmount(parseFloat(formatEther(outputAmountUnits)));
      setFeeCharged(formatEther(feeUnits) + " ETH");
    } else if (toToken === "USDC") {
      setReceiveAmount(parseFloat(formatUnits(outputAmountUnits, 6)));
      setFeeCharged(formatUnits(feeUnits, 6) + " USDC");
    }
  }

  async function openOrder() {
    setOrderCreationTxHash("");
    setOrderFulfillmentTxHash("");
    setOrderSettlementTxHash("");
    setRelayedSettlementTxHash("");

    if (!address) return;

    const originChain = chainsMetadata.find((c) => c.slug === fromChain);
    if (!originChain) return;
    if (originChain.isParentChain) return;

    const destinationChain = chainsMetadata.find((c) => c.slug === toChain);
    if (!destinationChain) return;
    if (destinationChain.isParentChain) return;

    const nonce = Date.now();
    const fillDeadline = parseInt(((Date.now() + 60 * 1000) / 1000).toString());

    const order: OrderData = {
      sender: address,
      recipient: address,
      inputToken: fromToken === "ETH" ? zeroAddress : originChain.usdc.address,
      outputToken:
        toToken === "ETH" ? zeroAddress : destinationChain.usdc.address,
      amountIn:
        fromToken === "ETH"
          ? parseEther(inputAmount.toString())
          : parseUnits(inputAmount.toString(), 6),
      amountOut:
        toToken === "ETH"
          ? parseEther(receiveAmount.toString())
          : parseUnits(receiveAmount.toString(), 6),
      senderNonce: BigInt(nonce),
      originDomain: originChain.id,
      destinationDomain: destinationChain.id,
      destinationSettler: destinationChain.oif.router,
      fillDeadline: fillDeadline,
      data: "0x",
    };

    const encodedOrder = encodeOrder(order);

    const originClient = createPublicClient({
      chain: originChain,
      transport: http(),
    });
    const destinationClient = createPublicClient({
      chain: destinationChain,
      transport: http(),
    });

    if (fromToken === "USDC") {
      const allowance = await readContract(originClient, {
        abi: erc20Abi,
        address: originChain.usdc.address,
        functionName: "allowance",
        args: [address, originChain.oif.router],
      });

      if (allowance < parseUnits(inputAmount.toString(), 6)) {
        const approvalTx = await writeContractAsync({
          abi: erc20Abi,
          address: originChain.usdc.address,
          functionName: "approve",
          args: [originChain.oif.router, maxUint256],
        });

        await waitForTransactionReceipt(originClient, {
          hash: approvalTx,
        });
      }
    }

    const tx = await writeContractAsync({
      abi: hyperlane7683Abi,
      address: originChain.oif.router,
      functionName: "open",
      args: [
        {
          fillDeadline: order.fillDeadline,
          orderDataType: ORDER_DATA_TYPE_HASH,
          orderData: encodedOrder,
        },
      ],
      value:
        fromToken === "ETH" ? parseEther(inputAmount.toString()) : BigInt(0),
    });

    const receipt = await waitForTransactionReceipt(walletClient!, {
      hash: tx,
    });

    console.log({ receipt });

    setShowProgressModal(true);
    setOrderCreationTxHash(tx);

    const parsedLogs = parseEventLogs({
      abi: hyperlane7683Abi,
      logs: receipt.logs,
    });
    let orderId = "";
    for (const log of parsedLogs) {
      if (log.eventName === "Open") {
        orderId = log.args.orderId;
        break;
      }
    }

    const unwatchDestinationEvents = destinationClient.watchContractEvent({
      abi: hyperlane7683Abi,
      address: destinationChain.oif.router,
      onLogs: (logs) => {
        for (const log of logs) {
          // @ts-expect-error orderId is not typed
          if (log.eventName === "Filled" && log.args.orderId === orderId) {
            setOrderFulfillmentTxHash(log.transactionHash);
          }

          if (
            log.eventName === "Settle" &&
            // @ts-expect-error orderIds is not typed
            log.args.orderIds.includes(orderId)
          ) {
            setOrderSettlementTxHash(log.transactionHash);
          }
        }
      },
    });

    const unwatchOriginEvents = originClient.watchContractEvent({
      abi: hyperlane7683Abi,
      address: originChain.oif.router,
      onLogs: (logs) => {
        for (const log of logs) {
          // @ts-expect-error orderId is not typed
          if (log.eventName === "Settled" && log.args.orderId === orderId) {
            setRelayedSettlementTxHash(log.transactionHash);
          }
        }
      },
    });

    return () => {
      unwatchDestinationEvents();
      unwatchOriginEvents();
    };
  }

  useEffect(() => {
    try {
      estimateSwap();
    } catch (error) {
      console.error(error);
    }
  }, [fromToken, toToken, inputAmount]);

  useEffect(() => {
    const chain = chainsMetadata.find((c) => c.slug === fromChain);
    if (!chain) return;
    if (chain.isParentChain) return;

    switchChain({
      chainId: chain.id,
      // @ts-expect-error Weird readonly issues
      addEthereumChainParameter: chain,
    });
  }, [fromChain]);

  return (
    <>
      <Card className="w-full">
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 p-6">
            <span className="text-sm text-muted-foreground">You pay</span>
            <div className="flex items-center w-full gap-2 group">
              <Input
                className="text-3xl"
                type="text"
                placeholder="0"
                required
                value={inputAmount}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (isNaN(value)) {
                    setInputAmount(0);
                  } else {
                    setInputAmount(value);
                  }
                }}
              />
              <TokenSelector value={fromToken} setValue={setFromToken} />
              <span>on</span>
              <ChainSelector value={fromChain} setValue={setFromChain} />
            </div>
          </div>

          <div className="h-0.5 flex items-center justify-center border-b">
            <Button variant="outline" size="icon">
              <ChevronDownIcon className="size-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-2 p-6">
            <span className="text-sm text-muted-foreground">You receive</span>
            <div className="flex items-center w-full gap-2 group">
              <Input
                className="text-3xl"
                type="text"
                placeholder="0"
                pattern="[0-9]*"
                value={receiveAmount}
                disabled
              />
              <TokenSelector value={toToken} setValue={setToToken} />
              <span>on</span>
              <ChainSelector value={toChain} setValue={setToChain} />
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col w-full gap-2">
          {address ? (
            <Button size="lg" className="w-full rounded-md" onClick={openOrder}>
              Swap
            </Button>
          ) : (
            <ConnectButton />
          )}

          <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
            <span>1 ETH = 2 USDC</span>
            <span>Fee: {feeCharged}</span>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={showProgressModal} onOpenChange={setShowProgressModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Affogato Swap Progress</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <hr />

            <div className="flex items-center gap-2">
              {!!orderCreationTxHash ? (
                <>
                  <CheckIcon className="text-green-500 size-4" />
                  <span>
                    Order created on origin chain (Tx Hash:{" "}
                    {orderCreationTxHash.substring(0, 6)}...
                    {orderCreationTxHash.substring(
                      orderCreationTxHash.length - 4
                    )}
                    )
                  </span>
                </>
              ) : (
                <>
                  <LoaderIcon className="size-4 animate-spin" />
                  <span>
                    Waiting for order to be created on origin chain...
                  </span>
                </>
              )}
            </div>

            <hr />

            <div className="flex items-center gap-2">
              {!!orderFulfillmentTxHash ? (
                <>
                  <CheckIcon className="text-green-500 size-4" />
                  <span>
                    Filler filled order on destination chain (Tx Hash:{" "}
                    {orderFulfillmentTxHash.substring(0, 6)}...
                    {orderFulfillmentTxHash.substring(
                      orderFulfillmentTxHash.length - 4
                    )}
                    )
                  </span>
                </>
              ) : (
                <>
                  <LoaderIcon className="size-4 animate-spin" />
                  <span>
                    Waiting for Espresso finality for created order on origin
                    chain...
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!!orderSettlementTxHash ? (
                <>
                  <CheckIcon className="text-green-500 size-4" />
                  <span>
                    Order settled on destination chain (Tx Hash:{" "}
                    {orderSettlementTxHash.substring(0, 6)}...
                    {orderSettlementTxHash.substring(
                      orderSettlementTxHash.length - 4
                    )}
                    )
                  </span>
                </>
              ) : (
                <>
                  <LoaderIcon className="size-4 animate-spin" />
                  <span>
                    Waiting for order to be settled on destination chain...
                  </span>
                </>
              )}
            </div>

            <hr />

            <div className="flex items-center gap-2">
              {!!relayedSettlementTxHash ? (
                <>
                  <CheckIcon className="text-green-500 size-4" />
                  <span>
                    Order settled on origin chain via Hyperlane(Tx Hash:{" "}
                    {relayedSettlementTxHash.substring(0, 6)}...
                    {relayedSettlementTxHash.substring(
                      relayedSettlementTxHash.length - 4
                    )}
                    )
                  </span>
                </>
              ) : (
                <>
                  <LoaderIcon className="size-4 animate-spin" />
                  <span>
                    Waiting for Espresso finality for settlement transaction...
                  </span>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
