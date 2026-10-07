import { STAGES, type TrackStage } from "@/lib/domain/stages";
import { Chip } from "./Chip";
import { ChipGroup } from "./ChipGroup";

/**
 * Early, middle or late stage. Choosing one again clears it. Under the chips, the chosen
 * stage's one-line description, so the choice says what it means for planning.
 */
export function StageFilter({
  value,
  onChange,
  counts,
  label = "Stage of the people in the room",
}: {
  value: TrackStage | undefined;
  onChange: (stage: TrackStage | undefined) => void;
  counts?: Record<TrackStage, number>;
  label?: string;
}) {
  const chosen = STAGES.find((stage) => stage.id === value);
  return (
    <ChipGroup label={label} note={chosen ? chosen.blurb : undefined}>
      {STAGES.map((stage) => (
        <Chip key={stage.id} pressed={value === stage.id} count={counts?.[stage.id]} onClick={() => onChange(value === stage.id ? undefined : stage.id)}>
          {stage.label}
        </Chip>
      ))}
    </ChipGroup>
  );
}
