import { ACTIVITY_FORMATS, FORMAT_LABELS, type ActivityFormat } from "@/lib/domain/formats";
import { Chip } from "./Chip";
import { ChipGroup } from "./ChipGroup";

/** The kind of activity: reminiscence prompts, cognitive games, trivia, printable sheets, and the rest of a day's rhythm. */
export function FormatFilter({
  value,
  onChange,
  counts,
  label = "Kind of activity",
}: {
  value: ActivityFormat | undefined;
  onChange: (format: ActivityFormat | undefined) => void;
  counts?: Record<ActivityFormat, number>;
  label?: string;
}) {
  return (
    <ChipGroup label={label}>
      {ACTIVITY_FORMATS.map((format) => (
        <Chip key={format} pressed={value === format} count={counts?.[format]} onClick={() => onChange(value === format ? undefined : format)}>
          {FORMAT_LABELS[format]}
        </Chip>
      ))}
    </ChipGroup>
  );
}
