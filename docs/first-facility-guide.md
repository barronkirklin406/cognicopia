# Your first facility, step by step

A plain-words guide for the owner: from the first hello to a paid license, using what Cognicopia already has. Every step says who does it and where. Nothing here needs you to type into a terminal.

> **About button names.** The pages named here (the pricing page, License Desk, the pilot page) are written from their text in this repository. Your screen may look a little different. Do one step, and if a word on your screen does not match, tell me what you see and I will adjust the next step.

## Part 1. Once, before the first facility

These are yours to do. None of them involve a resident.

1. **A W-9.** Facilities ask for one when they add a new vendor. It is the IRS's free form (search for "IRS Form W-9"). Fill it in on your own computer with your business name, Minot, ND address and your EIN, and save it as a PDF. **Do not paste the EIN into a chat, an email draft you have not checked, or any file in the repository.** The PDF goes only to the facility's accounts payable, when they ask.
2. **Your DUNS number.** You applied and are in the waiting period. Until it arrives, the vendor block on the pricing page says "Application in progress. Available when issued." When the number comes, tell me and I will change that one line (it is `VENDOR.duns` in `js/invoiceMaker.js`).
3. **Where checks should be mailed.** Decide on one mailing address (a PO box is fine). It goes in your confirmation email to the facility, not on the website.
4. **Bank details for ACH.** Never put your account or routing number on a website or in the repository. Give it only on the final invoice you send by email.
5. **Your signing key.** The license key that unlocks a facility is signed on your computer, with a secret file only you hold. Confirm you still have that file and a backup of it (License Desk, step 1, makes it). If you lose it, every license has to be made again.
6. **Read the terms once.** Open `terms.html` on the site and have an attorney look at it before the first facility signs anything. It is a plain statement of purpose, not legal advice.

## Part 2. Finding the right person

A facility buys through three people. Know what each cares about.

- **The Activity Director** uses it every day. They care about the packets being easy, large print and respectful. This is your first conversation.
- **The administrator or executive director** signs off. They care about cost, privacy and risk. Send them the page "Privacy and data" and the page of security questions on the Resources menu.
- **Accounts payable** pays. They care about a W-9, a vendor name, terms and a PO number. The invoice request on the pricing page is made for them.

Say only what is true. Use "No resident data leaves the device" and "supports a facility's HIPAA privacy practices". **Never say Cognicopia is "HIPAA compliant"**: compliance belongs to the facility's own program. Never say it treats, diagnoses or improves a condition: the terms say it is an activity tool.

## Part 3. A free 30-day pilot

Nothing needs a key to start. The first 25 packets are free on every computer.

1. Send the Activity Director the pilot page (`pilot.html`, "Start a 30-day pilot") and the sample packet. It is a 30-day plan they can follow on their own.
2. Ask them to use it on the computer they print from, with made-up or alias names first. Cognicopia keeps resident details in that browser only.
3. **If 25 packets are not enough for a fair pilot,** make a short pilot key in License Desk: the plan "Annual facility license" and a **paid-through date** about 30 days away. The key keeps working **90 days past** that date, even with no internet, so choose the date with that in mind.
4. Check in on about day 3, day 10, day 20 and day 28. Ask what they printed, what they would change, and who else needs to see it.
5. Ask, in your own words, whether they would be willing to say a sentence about it. Only use a quote they have agreed to, with their name and role as they agree.

## Part 4. When they say yes: three ways to pay

| They want | What happens | Who does it |
|---|---|---|
| **A card** (an activity department card is common at $39 a month) | They use the buy button on the pricing page. After they pay, the activation page shows the key. | They do. You do nothing. |
| **A purchase order or invoice, Net 30** | They make an invoice request PDF on the pricing page (section "Pay by purchase order or invoice (Net 30)"), forward it to accounts payable and email you a copy. | Part 5 below. |
| **Several buildings** | Ask for a quote on the pricing page. You write the price, then follow the invoice steps. | You decide the price. |

## Part 5. The invoice route, one step at a time

1. **They make the request.** On the pricing page they fill in the facility, the billing contact, the accounts payable phone, the address, the PO number if they have one (otherwise it prints "PO PENDING"), the license and how many buildings. The PDF is made on their computer. Nothing is sent to you by the website, so ask them to email you the PDF at cognicopia@outlook.com.
2. **You check it.** Is the facility real, the plan right, the building count right? A reference such as `CGR-20261021-1234` is printed on it.
3. **You confirm by email.** Reply that you have it. Attach your W-9 if they asked. Say how to pay: a check payable to BarronCrafts to your mailing address, or ACH with the bank details **you** write into that email.
4. **The final invoice.** The PDF from the page is a *request*, not a final invoice. Make your own final invoice with your own invoice number (a simple document or your accounting tool is fine) with the same facility, line item, amount, PO number, date and "Payment Due within 30 Days of Invoice Date." Invoices can now be made and chased automatically: see [net30-desk.md](net30-desk.md) (a scheduled agent turns a facility's emailed request into a Stripe invoice and the license service emails the key). Until that is switched on, make the final invoice yourself as described here.
5. **The key.** Open License Desk (`https://cognicopia.org/license-desk.html`). Choose your secret file, type the facility's name as it should print, choose the plan, and set the **paid-through date** (a year from the payment date for an annual license). Make the key, then copy the email it prepares. Send it to the billing contact with the invoice, which is what the pricing page tells facilities to expect.
6. **Keep a list.** A simple spreadsheet on your own computer: facility, plan, invoice number, date paid, paid-through date, key id. **Never put a resident's name in it.**

## Part 6. After they pay

- Send the key email if you have not. It includes a one-click link that turns the license on.
- Ask the Activity Director to open the Packet Builder, add a few residents by alias or room, and make one packet together on a call or by email.
- Put a reminder in your calendar about 30 days before the paid-through date to ask about renewal. A license keeps working 90 days after that date, so a late payment never stops a unit in the middle of a week.
- If a payment bounces, you can withdraw a key. Tell me and I will add its id to the withdrawn list.

## Part 7. A checklist to print

- [ ] W-9 saved as a PDF on my computer (EIN not written anywhere else)
- [ ] Mailing address for checks decided
- [ ] Signing key file and its backup found
- [ ] Attorney has read the terms
- [ ] Activity Director has the pilot page and the sample packet
- [ ] Administrator has the privacy page and the security questions
- [ ] Pilot check-ins on day 3, 10, 20 and 28
- [ ] Invoice request PDF received and checked
- [ ] Confirmation email sent with my W-9 if asked
- [ ] Final invoice sent with its own number
- [ ] License key made, emailed and written on my list
- [ ] Renewal reminder set 30 days before the paid-through date
