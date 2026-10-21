# The purchase-order and invoice request maker

A facility's accounts payable can buy Cognicopia without a card. On `pricing.html`, the section "Pay by purchase order or invoice (Net 30)" takes the facility's details and makes a one-page PDF **invoice request** on the computer, with the PDF library the site already carries. Nothing is sent: no server, no email from the page, no request of any kind. `scripts/check-invoice.mjs` proves that, and reads the downloaded PDF back with PyMuPDF.

## What it asks for

Facility or company name, billing contact name and email, accounts payable phone, street, city, state, ZIP, a purchase order (PO) number (optional: an empty one prints "PO PENDING"), the license (annual, monthly or Enterprise) and the number of buildings (1 to 99).

## What the PDF says

- The vendor: BarronCrafts / Cognicopia, Minot, ND 58701, with the contact email.
- A reference (`CGR-YYYYMMDD-nnnn`), the invoice date, "Payment terms: Net 30", the due date 30 days on, and the PO number.
- The facility, its billing contact and address, and one line: "Cognicopia Annual Facility Engagement License" or the monthly or Enterprise one, with the quantity, the unit price and the amount. The price comes from `src/config/license.js`, the one place prices live. **Enterprise prints "To be quoted"**, never a made-up price.
- "Payment Due within 30 Days of Invoice Date." and how to pay: a check payable to BarronCrafts, or ACH or wire with the bank details **sent by email with the final invoice**. No bank detail, EIN or DUNS number is written in any page or script.
- A vendor information block (legal name, location, EIN and DUNS status, payment methods, terms, contact), also shown on the page with a Copy button for procurement teams.
- "Please forward this generated PDF invoice to your Accounts Payable department." and a note that this is a **request, not a final invoice**: BarronCrafts confirms it by email and sends the final invoice with the license key.

The file is named `Cognicopia_Invoice_<FACILITY>_<DATE>.pdf`. It is marked `__noLegal` so the activity footer ("Not Medical Advice") is not printed on an invoice. If the PDF library cannot load, a plain printable copy of the same invoice is offered instead.

## What stays on the computer

The form's answers are kept in this browser only (`cognicopia_invoice_request`: a business's details, never a resident), so a second invoice needs no retyping. "Clear the form" removes them.

## Changing the vendor's facts

`VENDOR` at the top of `js/invoiceMaker.js` holds them. When the DUNS number is issued, change the `duns` line there; the check reads it from there. The EIN stays on the W-9, never on a page.

The step-by-step guide for a first facility is [first-facility-guide.md](first-facility-guide.md).
