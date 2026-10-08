import type { Metadata } from "next";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/Badge";
import { FocusOnMount } from "@/components/FocusOnMount";
import { Shell } from "@/components/Shell";
import { CancelInviteForm, InviteForm, RemoveMemberForm, RoleForm } from "@/components/team-forms";
import { requireAdmin } from "@/lib/access/guards";
import { teamNotice } from "@/lib/auth/messages";
import { first, type SearchParams } from "@/lib/auth/params";
import { listInvites } from "@/lib/data/invites";
import { listMembers } from "@/lib/data/team";
import { inviteState } from "@/lib/domain/invite";
import { formatDate } from "@/lib/domain/subscription";

export const metadata: Metadata = { title: "Team" };

/** Drawn for each request: it depends on who is signed in. */
export const dynamic = "force-dynamic";

/**
 * The people, and how to add them. Everyone has their own sign-in: an admin makes an
 * invitation link, shares it, and the person opens it and joins as staff or as an admin.
 */
export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, user, membership } = await requireAdmin("/admin/team");
  const notice = teamNotice(first((await searchParams).notice));
  const [members, invites] = await Promise.all([listMembers(db), listInvites(db)]);
  const now = new Date();

  return (
    <Shell session={{ user, membership }} current="/admin/team">
      <div className="stack">
        <h1>Team</h1>
        {notice ? (
          <FocusOnMount>
            <Alert tone="info">{notice}</Alert>
          </FocusOnMount>
        ) : null}

        <section className="stack" aria-labelledby="members-title">
          <h2 id="members-title">People</h2>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">The people in {membership.facility.facility_name}</caption>
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const you = member.id === user.id;
                  return (
                    <tr key={member.id}>
                      <td>
                        {member.email} {you ? <Badge>You</Badge> : null}
                      </td>
                      <td>
                        <RoleForm id={member.id} role={member.role} who={member.email} />
                      </td>
                      <td>{you ? null : <RemoveMemberForm id={member.id} who={member.email} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small muted">A facility always keeps at least one admin, so the last admin cannot be removed or changed to staff.</p>
        </section>

        <section className="stack" aria-labelledby="invite-title">
          <h2 id="invite-title">Invite someone</h2>
          <p>
            Make a link and send it to them yourself. They open it, sign in or create their own account, and join. Everyone has their own sign-in; there is no shared password. For a shared computer, invite a shared mailbox your facility controls.
          </p>
          <InviteForm />
        </section>

        <section className="stack" aria-labelledby="open-title">
          <h2 id="open-title">Invitations</h2>
          {invites.length === 0 ? (
            <p>No invitations yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">Invitations to join {membership.facility.facility_name}</caption>
                <thead>
                  <tr>
                    <th scope="col">For</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Cancel</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => {
                    const state = inviteState(invite, now);
                    const who = invite.email ?? "anyone with the link";
                    return (
                      <tr key={invite.id}>
                        <td>{invite.email ?? "Anyone with the link"}</td>
                        <td>{invite.role === "admin" ? "Admin" : "Staff"}</td>
                        <td>
                          {state === "open" ? <Badge tone="good">{`Open until ${formatDate(invite.expires_at)}`}</Badge> : null}
                          {state === "used" ? <Badge>{`Used ${formatDate(invite.accepted_at)}`}</Badge> : null}
                          {state === "expired" ? <Badge tone="warn">Expired</Badge> : null}
                        </td>
                        <td>{state === "open" ? <CancelInviteForm id={invite.id} who={who} /> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
