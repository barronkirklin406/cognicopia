import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { RenameForm } from "@/components/team-forms";
import { requireAdmin } from "@/lib/access/guards";

export const metadata: Metadata = { title: "Settings" };

/** Drawn for each request: it depends on who is signed in. */
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user, membership } = await requireAdmin("/admin/settings");
  return (
    <Shell session={{ user, membership }} current="/admin/settings">
      <div className="narrow stack">
        <h1>Settings</h1>
        <RenameForm name={membership.facility.facility_name} />
        <p className="small muted">
          Please keep resident names and health details out of Cognicopia. Group names, wing names and staff notes should describe a place or an activity, never a person.
        </p>
      </div>
    </Shell>
  );
}
