"use client";

import { useActionState } from "react";
import { cancelInviteAction, changeRoleAction, inviteAction, removeMemberAction, renameFacilityAction } from "@/app/admin/actions";
import { emptyState } from "@/lib/auth/state";
import type { FacilityRole } from "@/lib/db/models";
import { Field, FormAlerts, SubmitButton } from "./forms";

/** Make an invitation. The link it makes is shown once, in the form's own message. */
export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteAction, emptyState);
  return (
    <form action={formAction} className="stack">
      <FormAlerts state={state} />
      <Field
        name="email"
        label="Their email address (optional)"
        type="email"
        autoComplete="off"
        defaultValue={state.values?.email}
        hint="If you enter one, only that address can use the link. Leave it empty to make a link anyone you share it with can use, once."
        error={state.fieldErrors?.email}
      />
      <div className="field">
        <label htmlFor="invite-role">Role</label>
        <select id="invite-role" name="role" defaultValue="staff" aria-describedby="invite-role-hint">
          <option value="staff">Staff: the activity library and the calendar tools</option>
          <option value="admin">Admin: also the team, settings and billing</option>
        </select>
        <span id="invite-role-hint" className="hint">
          You can change anyone's role later.
        </span>
        {state.fieldErrors?.role ? <span className="error">{state.fieldErrors.role}</span> : null}
      </div>
      <SubmitButton pending={pending} pendingText="Creating…">
        Create invitation link
      </SubmitButton>
    </form>
  );
}

export function RoleForm({ id, role, who }: { id: string; role: FacilityRole; who: string }) {
  const [state, formAction, pending] = useActionState(changeRoleAction, emptyState);
  const selectId = `role-${id}`;
  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="id" value={id} />
      <div className="row">
        <label htmlFor={selectId} className="sr-only">{`Role for ${who}`}</label>
        <select id={selectId} name="role" defaultValue={role}>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
        <SubmitButton pending={pending} pendingText="Saving…" className="btn secondary small" label={`Save the role for ${who}`}>
          Save
        </SubmitButton>
      </div>
      <FormAlerts state={state} />
    </form>
  );
}

export function RemoveMemberForm({ id, who }: { id: string; who: string }) {
  const [state, formAction, pending] = useActionState(removeMemberAction, emptyState);
  return (
    <form
      action={formAction}
      className="stack"
      onSubmit={(event) => {
        if (!window.confirm(`Remove ${who} from the facility? They will lose access to its library and calendars.`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton pending={pending} pendingText="Removing…" className="btn danger small" label={`Remove ${who}`}>
        Remove
      </SubmitButton>
      <FormAlerts state={state} />
    </form>
  );
}

export function CancelInviteForm({ id, who }: { id: string; who: string }) {
  const [state, formAction, pending] = useActionState(cancelInviteAction, emptyState);
  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="id" value={id} />
      <SubmitButton pending={pending} pendingText="Cancelling…" className="btn secondary small" label={`Cancel the invitation for ${who}`}>
        Cancel
      </SubmitButton>
      <FormAlerts state={state} />
    </form>
  );
}

export function RenameForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(renameFacilityAction, emptyState);
  return (
    <form action={formAction} className="stack">
      <FormAlerts state={state} />
      <Field name="facility_name" label="Facility name" autoComplete="organization" defaultValue={state.values?.facility_name ?? name} error={state.fieldErrors?.facility_name} maxLength={120} required />
      <SubmitButton pending={pending} pendingText="Saving…">
        Save the name
      </SubmitButton>
    </form>
  );
}
