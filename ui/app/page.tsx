import { BalancesCard } from "@/components/balances-card";
import { PriceWarningCard } from "@/components/price-warning-card";
import { SwapWidget } from "@/components/swap-widget";

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col gap-4 w-full items-center justify-center">
      <div className="flex flex-col gap-2 max-w-2xl">
        <BalancesCard />
        <PriceWarningCard />
        <SwapWidget />
      </div>
    </div>
  );
}
