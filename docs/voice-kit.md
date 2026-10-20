# Voice kit: one natural voice for Tablet Activities, Tablet Interactive Mode and the Academy

The logic is `js/voiceKit.js` (global `CogniVoice`). It is checked by `scripts/check-voice-kit.mjs` (in `npm test`, with a stand-in for the browser's speech) and `scripts/check-voice-ui.mjs` (a real browser, in `npm run build`).

## What it does

- **Which voice.** Only voices installed on the device. A voice the browser streams from a company's server (Chrome's "Google" voices and the online "Natural" voices in Edge are examples) is never used, because the words it speaks could carry a resident's first name. Of the local English voices, novelty and legacy ones are dropped and the rest are ranked: names saying Natural, Neural, Premium, Enhanced or Siri first, then well-known modern names, then the rest. iPad Safari fills its voice list late, so the list is read again on `voiceschanged` and for a few seconds afterward.
- **How it speaks.** Pace Natural 0.90 (Slow 0.78, Normal 1.0), pitch 1.0. Text is cut at commas, colons, full stops and ellipses and spoken in short pieces with a small gap after each (110, 200, 320 and 480 ms), but not after "Mr." or inside a decimal.
- **Voice settings** (the Voice settings button in the Tablet menu toolbar (not in each activity: the activity bar has no room for a 72 px button), "Voice settings" beside Read to Me in Tablet Interactive Mode, and the Voice button in the Academy player): three paces, the voices on the device each with Preview and Use, and a test sentence, "Welcome to today's activity." The choice is kept on the device (`localStorage` key `cognicopia_voice`, voice name and pace only).
- **Academy High-Fidelity Voice** (default on). On: a recorded narration plays when a lesson has one (`audio.src` in the course data), with a gentle low-pass filter through the Web Audio API, otherwise the most natural voice on the device reads it. Off: the device's standard voice reads every lesson. No recordings ship today, so the switch changes only which voice is chosen until recordings are added.

## What it cannot do

- It cannot make a device's voice sound better than the voices installed on it. If a device has only basic voices, the panel says so.
- The browser does not let a text-to-speech voice pass through the Web Audio graph, so the smoothing filter applies to recordings only.
- This was proved with a stand-in for the device's speech. How a voice sounds has to be heard on the device.
- In the Academy, a lesson line is spoken as one piece so that the word being read can be followed in the transcript, so the pauses at commas are the voice's own there.
