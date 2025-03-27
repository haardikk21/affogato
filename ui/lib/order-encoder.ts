import { addressToBytes32 } from "@hyperlane-xyz/utils";
import { encodeAbiParameters, zeroAddress } from "viem";

export type OrderData = {
  sender: `0x${string}`;
  recipient: `0x${string}`;
  inputToken: `0x${string}`;
  outputToken: `0x${string}`;
  amountIn: bigint;
  amountOut: bigint;
  senderNonce: bigint;
  originDomain: number;
  destinationDomain: number;
  destinationSettler: `0x${string}`;
  fillDeadline: number;
  data: `0x${string}`;
};

export function encodeOrder(_order: OrderData) {
  const order = { ..._order };

  console.log({ order });

  if (order.sender.length === 42) {
    order.sender = addressToBytes32(order.sender) as `0x${string}`;
  }

  if (order.recipient.length === 42) {
    order.recipient = addressToBytes32(order.recipient) as `0x${string}`;
  }

  if (order.inputToken.length === 42) {
    if (order.inputToken === zeroAddress) {
      order.inputToken =
        "0x0000000000000000000000000000000000000000000000000000000000000000";
    } else {
      order.inputToken = addressToBytes32(order.inputToken) as `0x${string}`;
    }
  }

  if (order.outputToken.length === 42) {
    if (order.outputToken === zeroAddress) {
      order.outputToken =
        "0x0000000000000000000000000000000000000000000000000000000000000000";
    } else {
      order.outputToken = addressToBytes32(order.outputToken) as `0x${string}`;
    }
  }

  if (order.destinationSettler.length === 42) {
    order.destinationSettler = addressToBytes32(
      order.destinationSettler
    ) as `0x${string}`;
  }

  const abiType = [
    {
      name: "order",
      type: "tuple",
      internalType: "struct OrderData",
      components: [
        {
          name: "sender",
          type: "bytes32",
        },
        {
          name: "recipient",
          type: "bytes32",
        },
        {
          name: "inputToken",
          type: "bytes32",
        },
        {
          name: "outputToken",
          type: "bytes32",
        },
        {
          name: "amountIn",
          type: "uint256",
        },
        {
          name: "amountOut",
          type: "uint256",
        },
        {
          name: "senderNonce",
          type: "uint256",
        },
        {
          name: "originDomain",
          type: "uint32",
        },
        {
          name: "destinationDomain",
          type: "uint32",
        },
        {
          name: "destinationSettler",
          type: "bytes32",
        },
        {
          name: "fillDeadline",
          type: "uint32",
        },
        {
          name: "data",
          type: "bytes",
        },
      ],
    },
  ] as const;

  const encodedOrder = encodeAbiParameters(abiType, [order]);
  return encodedOrder;
}
