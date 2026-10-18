# Technical Architecture & Browser Cryptography Audit
**System:** Cognicopia.org Client-Side Healthcare SaaS  
**Target:** Zero-Cloud Protected Health Information (ePHI) Handling & Browser Cryptographic Subsystem  
**Author:** Principal Cloud Security Architect & Web Cryptography Engineer  
**Standard Compliance:** HIPAA Security Rule (45 CFR Part 160 & Part 164, Subparts A & C), NIST SP 800-38D, NIST SP 800-132, FIPS 140-3  

---

## 1. Executive Summary & Zero-Cloud Threat Model

Memory care and elder-care facilities process highly sensitive biographical, familial, and cognitive health data (ePHI under HIPAA 45 CFR § 160.103). Traditional SaaS architectures transmit resident profiles (e.g., full names, cognitive stages, life narratives, trauma triggers, familial relations) to cloud-hosted databases (RDS, Supabase, Firestore, DynamoDB) and render PDFs via serverless Lambdas or containerized Headless Chromium instances.

### 1.1 Vulnerabilities of Legacy Approaches
1. **Unencrypted `localStorage` Exposure:**
   - `localStorage` stores strings unencrypted in plaintext SQLite or LevelDB files on the host machine.
   - Any client-side Cross-Site Scripting (XSS) vulnerability or rogue browser extension can synchronously exfiltrate all stored records via `localStorage.getItem()`.
   - Shared workstations at nursing stations or activity coordinator desks expose plaintext records to unauthorized personnel upon browser restart or console inspection.
2. **Cloud Exfiltration & Subprocessor Liability:**
   - Server-side PDF generation transmits resident profiles across the public internet to third-party cloud infrastructure, requiring comprehensive Business Associate Agreements (BAAs), SOC 2 Type II controls, and breach notification infrastructure.

### 1.2 Zero-Cloud ePHI Architectural Directive
Cognicopia mandates a **Zero-Cloud Architecture**:
- Resident biographical details, cognitive stages, family members, and session notes **never leave the user's browser**.
- No persistent cloud databases store resident records.
- All PDF packets, memory journals, and multi-resident bundles are rendered **entirely in client-side volatile memory** via the HTML5 Canvas and native JavaScript/WebAssembly PDF pipelines.
- Data at rest in the client browser is encrypted using **AES-256-GCM** inside **IndexedDB**, with key derivation performed via **PBKDF2** (or Argon2id) and non-extractable keys maintained in volatile memory with automated inactivity purges.

---

## 2. Client-Side Database Schema (IndexedDB + Web Cryptography API)

Raw `localStorage` is completely decommissioned for all ePHI. All local storage is transitioned to a multi-store IndexedDB (`CognicopiaSecureDB_v2`) utilizing Envelope Encryption (Key Encryption Key / Data Encryption Key model).

### 2.1 Object Stores
1. **`keyring` Store:**
   - Stores the cryptographically wrapped Data Encryption Key (DEK).
   - Key: `"master_dek"`
   - Value Schema:
     ```typescript
     interface WrappedKeyRecord {
       id: string;               // "master_dek"
       salt: Uint8Array;         // 16 bytes CSPRNG salt for PBKDF2
       iterations: number;       // 600,000 rounds
       iv: Uint8Array;           // 12 bytes IV for AES-GCM key wrapping
       wrappedKey: ArrayBuffer;  // AES-256-GCM encrypted raw 256-bit DEK
       createdAt: number;
       updatedAt: number;
     }
     ```
2. **`records` Store (Encrypted Resident Profiles):**
   - Stores encrypted JSON payloads with authenticated metadata.
   - Key: `id` (UUID v4 or deterministic pseudonym)
   - Value Schema:
     ```typescript
     interface EncryptedRecord {
       id: string;               // Resident ID / record identifier
       iv: Uint8Array;           // 12 bytes CSPRNG IV (NIST SP 800-38D)
       ciphertext: ArrayBuffer;  // AES-256-GCM encrypted payload
       tagLength: 128;           // 128-bit authentication tag appended
       version: number;          // Schema version
       updatedAt: number;        // Epoch timestamp
     }
     ```
3. **`blobs` Store (Encrypted Artifacts / Saved PDF Bundles):**
   - Key: `bundleId`
   - Value: Chunks of encrypted ArrayBuffers for rendered PDF documents, protected with distinct IVs.

### 2.2 Authenticated Additional Data (AAD)
To prevent ciphertext swap attacks (e.g., swapping Record A's ciphertext into Record B's slot), the record ID and tenant/facility namespace are passed as `additionalData` to `crypto.subtle.encrypt` and `crypto.subtle.decrypt`. If an attacker manipulates the database key, decryption fails with an authentication tag mismatch.

---

## 3. Cryptographic Lifecycle & Session Management

```
[ User Passphrase / Facility Secret ]
              │
              ▼
    [ PBKDF2 / SHA-256 ] (600,000 iterations, 16-byte CSPRNG Salt)
              │
              ▼
   [ Key Encryption Key (KEK) ] (AES-256-GCM, Non-Extractable)
              │
              ├───────────────────────────────┐
              ▼                               ▼
   [ Decrypt Wrapped DEK ]         [ Encrypt New Random DEK ]
   (Initial / Existing Session)     (First Initialization)
              │                               │
              └───────────────┬───────────────┘
                              ▼
        [ Master Data Encryption Key (DEK) ]
           • Non-Extractable (extractable: false)
           • Volatile Memory Only (TypeScript KeySession)
           • AES-256-GCM (256-bit)
                              │
     ┌────────────────────────┴────────────────────────┐
     ▼                                                 ▼
[ Encrypt Resident ePHI ]                   [ Decrypt Resident ePHI ]
• 12-Byte CSPRNG IV                         • Verify 128-bit Auth Tag
• AAD = RecordID                            • Verify AAD
• Write to IndexedDB                        • Pass to In-Memory PDF Pipeline
     │                                                 │
     └────────────────────────┬────────────────────────┘
                              ▼
                  [ Inactivity / Logout Event ]
                              │
                              ▼
                    [ Key Session Purge ]
                    • Overwrite memory references
                    • Invalidate session timer
                    • Clear decrypted DOM/buffers
```

### 3.1 Browser-Side Key Derivation & Wrapping
1. **Entropy Generation:** CSPRNG via `window.crypto.getRandomValues()`.
2. **Key Derivation (PBKDF2):**
   - Iterations: `600,000` (conforming to OWASP 2023+ and NIST SP 800-132 recommendations).
   - Hash: `SHA-256`.
   - Salt: 16 bytes generated per database initialization.
3. **Key Isolation (`extractable: false`):**
   - All `CryptoKey` instances created via `subtle.deriveKey` or `subtle.importKey` set `extractable: false`.
   - Even in the event of an XSS injection, attacker code cannot call `crypto.subtle.exportKey()` to steal raw key bytes.

### 3.2 In-Memory Session Caching & Automatic Purge
1. **Volatile Key Cache:** The unsealed DEK is held in a private closure scope inside the session manager.
2. **Inactivity Guard (15m / 60m / 8h Shift):**
   - User interaction hooks (`keydown`, `pointerdown`, `scroll`) touch an activity timestamp.
   - An inactivity worker evaluates elapsed time against the retention budget.
   - Upon timeout: the key reference is nullified, internal object caches are zeroed, and the UI transitions to the Locked State.
3. **Teardown Hooks:** `beforeunload`, `pagehide`, and explicit Logout trigger instantaneous key unsetting and IndexedDB connection closure.

---

## 4. Zero-Cloud Client-Side PDF Compilation Pipeline

### 4.1 Architecture
Generating 5-page reminiscence packets or 50-resident batch bundles without cloud servers requires a strictly deterministic, low-memory browser execution pipeline:

```
[ Encrypted IndexedDB ]
         │ (DEK in Volatile Memory)
         ▼
[ In-Memory Resident Profile ]
         │ (Deterministic PRNG Seeded by Resident Name + Date)
         ▼
[ Procedural Content Generator (PCG) ]
         │ (Puzzles, Reminiscence Prompts, Word Searches, Mazes)
         ▼
[ Atkinson Hyperlegible Font Embedded (Base64 Data URI) ]
         │
         ▼
[ Client-Only jsPDF / WebAssembly Vector Pipeline ]
         │ • Safe margin clipping (0.5 in / 0.75 in binding margin)
         │ • Clinical matrix type floor enforcement (14pt / 18pt / 24pt bold)
         │ • Rule stroke floor enforcement (2.25pt / 3.0pt / 4.5pt)
         │ • Dignity filter pass (zero infantilizing / quizzing phrases)
         ▼
[ Volatile Blob / Object URL (`blob:null/...`) ]
         │
         ▼
[ Direct Browser Print / Local PDF Download ]
(Garbage collected immediately; zero network packets transmitted)
```

### 4.2 Network Isolation Guarantee
- **No Remote Fonts:** Font assets (Atkinson Hyperlegible) are embedded directly within the client bundle.
- **No Remote Image Fetching:** Line art, botanical drawings, and tactile icons are synthesized procedural SVGs or compiled binary vectors.
- **No Analytics / Beaconing:** Strict CSP disables outbound `connect-src` to third-party endpoints.

---

## 5. HIPAA Security Rule & NIST Mapping

| HIPAA Security Rule Standard | Implementation in Cognicopia Architecture | Verification Mechanism |
| :--- | :--- | :--- |
| **§ 164.312(a)(2)(iv) Encryption & Decryption at Rest** | AES-256-GCM encryption for all resident profile attributes in IndexedDB. DEK wrapped with PBKDF2 (600k iterations). | `crypto.subtle` self-test round trip verification in `resources/clinical-alignment/`. |
| **§ 164.312(e)(1) Transmission Security** | Zero-Cloud transmission model: ePHI is never transmitted across the network. Outbound request audit proves 0 ePHI network calls. | `Net.requests()` audit in test suite; `server.js` route isolation. |
| **§ 164.312(a)(2)(iii) Automatic Logoff** | Inactivity timeout watcher (configurable 15m/60m/8h) automatically purges in-memory `CryptoKey` and locks store. | Unit and behavioral test validation in `check-shift-ui.mjs` & `check-trial.mjs`. |
| **§ 164.312(c)(1) Data Integrity** | AES-GCM 128-bit authentication tag with Record ID as Authenticated Additional Data (AAD). | Tamper test: modified ciphertext fails tag validation immediately. |
| **§ 164.312(d) Audit Controls** | Local signed audit ledger (`CogniTrialLedger` / `CogniShiftBoard`) tracking local modifications without cloud telemetry. | Local append-only signed store in IndexedDB. |
