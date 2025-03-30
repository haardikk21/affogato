"use client";

import { useEthUsdcBalance } from "@/hooks/use-eth-usdc-balance";
import { formatEther, formatUnits } from "viem";
import { useAccount } from "wagmi";
import { chainsMetadata } from "../../filler/config/chainsMetadata";
import { Card, CardContent } from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { EthereumIcon, USDCIcon } from "./icons";

const FILLER_ADDRESS = "0x82328a10707D760528bE24A5B0516E80d9a5fa57";

export function BalancesCard() {
  const { address } = useAccount();

  const {
    userEthBalance: userTallEthBalance,
    usdcBalance: userTallUsdcBalance,
  } = useEthUsdcBalance(address, chainsMetadata[1]);
  const {
    userEthBalance: userGrandeEthBalance,
    usdcBalance: userGrandeUsdcBalance,
  } = useEthUsdcBalance(address, chainsMetadata[2]);
  const {
    userEthBalance: userVentiEthBalance,
    usdcBalance: userVentiUsdcBalance,
  } = useEthUsdcBalance(address, chainsMetadata[3]);

  const {
    userEthBalance: fillerTallEthBalance,
    usdcBalance: fillerTallUsdcBalance,
  } = useEthUsdcBalance(FILLER_ADDRESS, chainsMetadata[1]);
  const {
    userEthBalance: fillerGrandeEthBalance,
    usdcBalance: fillerGrandeUsdcBalance,
  } = useEthUsdcBalance(FILLER_ADDRESS, chainsMetadata[2]);
  const {
    userEthBalance: fillerVentiEthBalance,
    usdcBalance: fillerVentiUsdcBalance,
  } = useEthUsdcBalance(FILLER_ADDRESS, chainsMetadata[3]);

  if (!address) return null;

  return (
    <Card className="w-full">
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <span className="font-bold">Your Balances</span>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>☕ Chain</TableHead>
                  <TableHead>
                    <span className="flex gap-1 items-center">
                      <EthereumIcon className="size-4" /> ETH
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="flex gap-1 items-center">
                      <USDCIcon className="size-4" /> USDC
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Tall</TableCell>
                  <TableCell>
                    {parseFloat(
                      formatEther(userTallEthBalance?.value ?? BigInt(0))
                    ).toFixed(4)}{" "}
                    ETH
                  </TableCell>
                  <TableCell>
                    {formatUnits(userTallUsdcBalance ?? BigInt(0), 6)} USDC
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Grande</TableCell>
                  <TableCell>
                    {parseFloat(
                      formatEther(userGrandeEthBalance?.value ?? BigInt(0))
                    ).toFixed(4)}{" "}
                    ETH
                  </TableCell>
                  <TableCell>
                    {formatUnits(userGrandeUsdcBalance ?? BigInt(0), 6)} USDC
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Venti</TableCell>
                  <TableCell>
                    {parseFloat(
                      formatEther(userVentiEthBalance?.value ?? BigInt(0))
                    ).toFixed(4)}{" "}
                    ETH
                  </TableCell>
                  <TableCell>
                    {formatUnits(userVentiUsdcBalance ?? BigInt(0), 6)} USDC
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-bold">Filler Balances</span>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>☕ Chain</TableHead>
                  <TableHead>
                    <span className="flex gap-1 items-center">
                      <EthereumIcon className="size-4" /> ETH
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="flex gap-1 items-center">
                      <USDCIcon className="size-4" /> USDC
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Tall</TableCell>
                  <TableCell>
                    {parseFloat(
                      formatEther(fillerTallEthBalance?.value ?? BigInt(0))
                    ).toFixed(4)}{" "}
                    ETH
                  </TableCell>
                  <TableCell>
                    {formatUnits(fillerTallUsdcBalance ?? BigInt(0), 6)} USDC
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Grande</TableCell>
                  <TableCell>
                    {parseFloat(
                      formatEther(fillerGrandeEthBalance?.value ?? BigInt(0))
                    ).toFixed(4)}{" "}
                    ETH
                  </TableCell>
                  <TableCell>
                    {formatUnits(fillerGrandeUsdcBalance ?? BigInt(0), 6)} USDC
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Venti</TableCell>
                  <TableCell>
                    {parseFloat(
                      formatEther(fillerVentiEthBalance?.value ?? BigInt(0))
                    ).toFixed(4)}{" "}
                    ETH
                  </TableCell>
                  <TableCell>
                    {formatUnits(fillerVentiUsdcBalance ?? BigInt(0), 6)} USDC
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
