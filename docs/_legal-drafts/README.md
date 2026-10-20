# Legal drafts: for an attorney, not for the site

These two documents are drafts of terms of use and a privacy policy for Cognicopia, written from how the software and the business work today. **They are not in force and are not linked from any page.** They are here so that a lawyer reviewing them starts from the facts instead of a blank page.

The folder name starts with an underscore on purpose: the site's publisher (GitHub Pages, which runs Jekyll) does not publish folders that start with one. The repository is public, so anyone can read these files on GitHub; they are labeled draft in the first line.

What to give the attorney: both drafts, the page `resources/privacy-and-data/` (what the software actually does), and `docs/stripe-setup-guide.md` (the purchase flow).

## Questions the attorney should answer (the drafts leave these as bracketed text)

1. **Who is the contracting party?** A sole proprietor, an LLC or another entity, and the exact name that should appear.
2. **Governing law and venue.** The drafts leave the publisher's state as a blank ([CITY, STATE]) to be filled in by counsel. Is that right for customers in other states?
3. **Refund wording.** The pricing page says to ask within 30 days of the first payment for a refund. Is that the term to keep, and how should it read for an annual plan?
4. **Auto-renewal.** The annual plan renews once a year and can be cancelled before the renewal date. Do any states' automatic-renewal laws require specific notices or a cancellation method?
5. **Limitation of liability and disclaimers.** The software makes activity pages and records nothing about care. How far may the drafts go in saying it is not medical advice and not a medical record?
6. **Business associate agreement.** Cognicopia receives no protected health information. Does a facility ever still ask for a BAA, and what should the answer say?
7. **Licence terms.** One building per license, any number of computers, a 90-day grace period after the paid-through date. Are the permitted uses and the limits (no resale, no sharing a key across buildings) stated enough to enforce?
8. **Customer content.** Resident details stay on the customer's computer. Should the terms say the customer is responsible for what it types in and for its own backups?
9. **Privacy policy triggers.** Does the publisher's use of Stripe, GitHub Pages and email trigger any state privacy notice (for example California) at this size?
10. **Accessibility statement.** The site's statement says it has not yet been independently audited. Is that wording acceptable, and is there any procurement language a facility might expect?

When counsel has approved final text, the pages are added as `terms.html` and `privacy-policy.html`, listed in `scripts/seo.mjs`, and linked from the footer. Until then the site has no terms page.
