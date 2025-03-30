import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChainSlug } from "../../filler/config/types";

interface ChainSelectorProps {
  value: ChainSlug;
  setValue: (value: ChainSlug) => void;
}

export function ChainSelector({ value, setValue }: ChainSelectorProps) {
  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger className="w-fit">
        <SelectValue placeholder="Select a chain" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="tall">☕ Affogato Tall</SelectItem>
          <SelectItem value="grande">☕ Affogato Grande</SelectItem>
          <SelectItem value="venti">☕ Affogato Venti</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
