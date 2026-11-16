# platform/ is paused

Work on this folder (the separate facility service built with Next.js, Supabase and Stripe) is **paused** by the owner's decision of November 12, 2026 (playbook fix 10). It resumes only when the owner says so, which the playbook sets at about ten facilities paying for the offline product.

While it is paused:

- Do no new work here. Fixes for a security problem in what is already here are the one exception, and only if the owner asks.
- The public site links to nothing in this folder, and `_config.yml` keeps GitHub Pages from publishing it.
- The `platform` GitHub workflow still runs on any change here, so what exists stays green.
- If the service ever resumes, it holds **zero resident health information**: names, birth years and life stories stay in the browser on the facility's own computer.

The static site at the repository root is the product today. Its rules are in `CLAUDE.md`.
