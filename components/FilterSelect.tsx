"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all__";

export type FilterOption = { value: string; label: string };

export default function FilterSelect({
  value,
  onValueChange,
  options,
  allLabel,
  placeholder,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: FilterOption[];
  allLabel: string;
  placeholder: string;
}) {
  return (
    <Select value={value || ALL} onValueChange={(v) => onValueChange(v === ALL ? "" : v)}>
      <SelectTrigger aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
