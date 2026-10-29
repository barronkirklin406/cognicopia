# The 15-minute inactivity timeout

A screen left open on a shared computer does not stay open. `js/sessionTimeout.js` is on the packet tool, the Packet Builder and Resident Profiles.

After 15 minutes with no mouse movement, key, click, touch or scroll, it:

1. clears what is only on the screen: the unsaved packet draft and profile draft, and the one resident chosen for this tab;
2. locks the saved residents again if the facility has chosen a passphrase;
3. returns to the start (the Packet Builder's home screen, or the packet tool's front page for the profile form);
4. says: "Session timed out due to 15 minutes of inactivity to protect resident privacy."

**It deletes nothing that was saved.** The roster, the resident profiles, the license and the free-packet count stay exactly as they were. To keep a copy of the roster in a folder, the Roster screen's "Back up this roster, or hand it off to another station" section saves every resident in one locked file.

There is no "purge everything" button: the owner decided that wiping a roster someone built would make no sense. `scripts/check-session-timeout.mjs` proves all of this in a real browser, with a short limit set through `CognicopiaSession.setLimit()`.
