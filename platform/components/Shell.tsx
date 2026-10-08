import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/actions";
import type { Account, Membership } from "@/lib/access/context";

/**
 * The page frame: a header with the way around and who is signed in, and the
 * page's content in <main>. The links shown follow the person's role: admins also
 * see the team, billing and settings. Hiding a link is only a courtesy; the pages
 * themselves refuse anyone who should not be there.
 */
export function Shell({
  children,
  session,
  current,
}: {
  children: ReactNode;
  session?: { user: Account; membership: Membership | null };
  /** The path of this page, so its link can say "you are here". */
  current?: string;
}) {
  const membership = session?.membership ?? null;
  const isAdmin = membership?.role === "admin";
  const link = (href: string, label: string) => (
    <li>
      <Link href={href} aria-current={current === href ? "page" : undefined}>
        {label}
      </Link>
    </li>
  );

  return (
    <>
      <header className="site-header print:hidden">
        <div className="page-width">
          <Link className="brand" href={session ? "/dashboard" : "/"}>
            Cognicopia
          </Link>
          <nav aria-label="Main">
            <ul className="nav">
              {membership ? (
                <>
                  {link("/dashboard", "Home")}
                  {link("/library", "Library")}
                  {link("/reminiscence", "Reminiscence")}
                  {link("/calendar", "Calendar")}
                  {isAdmin ? (
                    <>
                      {link("/admin/team", "Team")}
                      {link("/admin/billing", "Billing")}
                      {link("/admin/settings", "Settings")}
                    </>
                  ) : null}
                </>
              ) : null}
              {session ? (
                <li>
                  <form action={signOutAction} className="inline-form">
                    <button type="submit" className="link-button">
                      Sign out
                    </button>
                  </form>
                </li>
              ) : (
                link("/login", "Sign in")
              )}
            </ul>
          </nav>
        </div>
        {session ? (
          <div className="page-width whoami">
            {membership ? `${membership.facility.facility_name} · ` : ""}
            {session.user.email ?? "Signed in"}
            {membership ? ` · ${isAdmin ? "Admin" : "Staff"}` : ""}
          </div>
        ) : null}
      </header>
      <main id="main" className="page-width print:m-0 print:w-full print:p-0">
        {children}
      </main>
    </>
  );
}
