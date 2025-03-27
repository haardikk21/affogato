import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChainSelectorProps {
  value: string;
  setValue: (value: string) => void;
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
