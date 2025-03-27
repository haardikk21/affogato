import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EthereumIcon, USDCIcon } from "./icons";

interface TokenSelectorProps {
  value: string;
  setValue: (value: string) => void;
}

export function TokenSelector({ value, setValue }: TokenSelectorProps) {
  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger className="w-fit">
        <SelectValue placeholder="Select a token" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="ETH">
            <EthereumIcon className="size-4" />
            ETH
          </SelectItem>
          <SelectItem value="USDC">
            <USDCIcon className="size-4" /> USDC
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
