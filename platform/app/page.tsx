import Link from "next/link";
import { Shell } from "@/components/Shell";

/** The front door. A signed-in visitor never sees it: the proxy sends them to their dashboard. */
export default function Home() {
  return (
    <Shell>
      <section className="hero stack">
        <h1>Activity planning for memory care teams</h1>
        <p>
          Cognicopia gives your activity team one shared place for the activity library and the month's calendar. Sign in to your facility's workspace, or set one up.
        </p>
        <div className="row">
          <Link className="btn" href="/login">
            Sign in
          </Link>
          <Link className="btn secondary" href="/signup">
            Create an account
          </Link>
        </div>
        <p className="small muted">
          Looking for the printable packets? They are on the <a href="https://cognicopia.org">main site</a>. Nothing about a resident is ever stored here.
        </p>
      </section>
    </Shell>
  );
}
