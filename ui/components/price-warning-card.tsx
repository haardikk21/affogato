import { TriangleAlertIcon } from "lucide-react";
import { Card, CardContent } from "./ui/card";

export function PriceWarningCard() {
  return (
    <Card className="w-full">
      <CardContent className="flex gap-2">
        <TriangleAlertIcon className="size-6 text-yellow-500" />
        <span className="max-w-prose">
          The price of ETH/USDC is fake due to limited testnet tokens. 1 ETH = 2
          USDC.
        </span>
      </CardContent>
    </Card>
  );
}
