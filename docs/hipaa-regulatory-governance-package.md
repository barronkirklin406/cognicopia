# HIPAA Regulatory Governance, Security Rule Compliance & Legal Agreement Package
**Entity:** Cognicopia (BarronCrafts LLC)  
**Classification:** B2B Healthcare SaaS / Memory Care & Long-Term Post-Acute Care (LTPAC) Platforms  
**Auditor Persona:** Healthcare Legal Counsel & HIPAA Regulatory Compliance Lead  
**Applicable Frameworks:** 
- Health Insurance Portability and Accountability Act of 1996 (HIPAA, 45 CFR Parts 160 & 164)
- Health Information Technology for Economic and Clinical Health Act (HITECH, 42 U.S.C. § 17931 et seq.)
- NIST SP 800-66 Rev. 2 (*Implementing the Health Insurance Portability and Accountability Act Security Rule*)
- NIST SP 800-63B (*Digital Identity Guidelines: Authentication and Lifecycle Management*)
- NIST SP 800-92 (*Guide to Computer Security Log Management*)
- HHS Office for Civil Rights (OCR) Enforcement and Breach Notification Final Omnibus Rules

---

## SECTION 1: BUSINESS ASSOCIATE AGREEMENT (BAA) TEMPLATE

*This Business Associate Agreement ("BAA" or "Agreement") supplements and is incorporated into the Master Services Agreement ("MSA") entered into by and between the senior living facility, memory care provider, skilled nursing facility, or healthcare operator ("Covered Entity") and BarronCrafts LLC d/b/a Cognicopia ("Business Associate").*

### RECITALS
**WHEREAS**, Covered Entity is a "Covered Entity" as defined under the Health Insurance Portability and Accountability Act of 1996, Public Law 104-191 ("HIPAA"), the Health Information Technology for Economic and Clinical Health Act ("HITECH"), and their implementing regulations at 45 CFR Parts 160 and 164 (collectively, the "HIPAA Rules");

**WHEREAS**, Business Associate provides proprietary software and client-side reminiscence packet generation tools designed specifically to minimize cloud exposure of Protected Health Information ("PHI") and electronic Protected Health Information ("ePHI");

**WHEREAS**, in performing services under the MSA, Business Associate provides software infrastructure that processes, renders, and maintains data locally within Covered Entity’s authorized browsers, with Zero-Cloud persistent storage of identifiable ePHI;

**NOW, THEREFORE**, in consideration of the mutual covenants contained herein, the parties agree as follows:

---

### ARTICLE I: DEFINITIONS
1.1 **General Rule.** Terms used, but not otherwise defined, in this BAA shall have the same meaning as those terms in the HIPAA Rules (45 CFR §§ 160.103, 164.304, 164.402, and 164.501).  
1.2 **Specific Definitions:**
- *(a) "Zero-Knowledge / Client-Side Encryption Architecture"* means the technical paradigm wherein all resident identifiers, clinical cognitive ratings, life stories, family member details, and reminiscence prompts are encrypted and decrypted exclusively inside the volatile memory and local sandboxed storage (IndexedDB) of Covered Entity’s local client browser. Business Associate never receives, possesses, or controls the cryptographic keys required to decrypt resident ePHI.
- *(b) "Unencrypted ePHI"* means ePHI that is not rendered unusable, unreadable, or indecipherable to unauthorized persons through the use of technology or methodology specified by the Secretary in guidance issued under Section 13402(h)(2) of HITECH (specifically, NIST SP 800-38D AES-256-GCM).
- *(c) "Security Incident"* means the attempted or successful unauthorized access, use, disclosure, modification, or destruction of information or interference with system operations in an Information System, as defined in 45 CFR § 164.304.

---

### ARTICLE II: TECHNICAL ARCHITECTURE & OBLIGATIONS OF BUSINESS ASSOCIATE
2.1 **Zero Persistent Cloud Storage Representation.**  
Business Associate represents and warrants that the Cognicopia software engine operates under a **Zero-Cloud ePHI Paradigm**:
- *(a)* Resident profiles, cognitive tiers (Early/Middle/Late), photos, and session notes are never stored in a multi-tenant cloud database, serverless data lake, or external persistence tier controlled by Business Associate.
- *(b)* All PDF rendering (including 5-page personalized packets, cognitive journals, and batch bundles) occurs client-side in the browser execution thread utilizing embedded font definitions (Atkinson Hyperlegible) and procedural vector drawing. Resident data is never dispatched to cloud-based rendering microservices.

2.2 **Client-Side Cryptographic Safeguards.**  
Business Associate warrants that any persistence within the local browser sandbox is guarded by:
- *(a)* FIPS 140-3 validated native Web Cryptography API executing **AES-256-GCM** authenticated symmetric encryption.
- *(b)* Per-record 96-bit unique Cryptographically Secure Pseudorandom Number Generator (CSPRNG) Initialization Vectors (IVs) and Authenticated Additional Data (AAD) binding to mitigate ciphertext manipulation.
- *(c)* Key derivation utilizing **PBKDF2-SHA-256 with 600,000 iterations** or **Argon2id**, enforcing non-extractable (`extractable: false`) CryptoKey attributes.

2.3 **Appropriate Safeguards (45 CFR § 164.504(e)(2)(ii)(B)).**  
Business Associate shall implement and maintain administrative, physical, and technical safeguards that reasonably and appropriately protect the confidentiality, integrity, and availability of the ePHI that it creates, receives, maintains, or transmits on behalf of Covered Entity, in accordance with Subpart C of 45 CFR Part 164.

2.4 **Subcontractors (45 CFR § 164.504(e)(2)(ii)(D)).**  
Business Associate shall ensure that any agent, including a subcontractor, to whom it provides ePHI (e.g., identity verification or immutable audit pipeline vendors) agrees in writing to the same restrictions and conditions that apply to Business Associate with respect to such information.

2.5 **Reporting of Unauthorized Disclosures or Security Incidents.**  
Business Associate shall report to Covered Entity any acquisition, access, use, or disclosure of ePHI not provided for by this Agreement, including Security Incidents and Breaches of Unsecured PHI as required by 45 CFR § 164.410, without unreasonable delay and in no event later than ten (10) calendar days following confirmation.

---

### ARTICLE III: PERMITTED USES AND DISCLOSURES
3.1 **General Performance.** Business Associate may use or disclose ePHI only as permitted or required by the MSA, this Agreement, or as Required by Law.  
3.2 **Zero Commercial Exploitation.** Business Associate is strictly prohibited from de-identifying, harvesting, synthesizing, or training Machine Learning (LLM/AI) foundation models on Covered Entity's ePHI or resident life stories without express prior written addenda.

---

### ARTICLE IV: TERM AND TERMINATION
4.1 **Term.** This Agreement shall become effective upon the Effective Date of the MSA and shall terminate when all ePHI provided by Covered Entity is destroyed or returned.  
4.2 **Termination for Cause.** Upon Covered Entity’s knowledge of a material breach by Business Associate of this Agreement, Covered Entity shall provide thirty (30) days written notice to cure. If uncured, Covered Entity may terminate immediately.  
4.3 **Effect of Termination & Cryptographic Erasure.** Because Business Associate maintains no persistent cloud copies of resident ePHI, termination triggers a cryptographic self-destruct command in the client software that invokes `window.indexedDB.deleteDatabase()` and overwrites all local volatile key caches across Covered Entity’s client workstations.

---

## SECTION 2: NIST SP 800-66 REV. 2 TECHNICAL SAFEGUARDS & ACCESS CONTROL PLAN

NIST Special Publication 800-66 Revision 2 (*Implementing the Health Insurance Portability and Accountability Act Security Rule*) mandates specific safeguards for access control (§ 164.312(a)), audit controls (§ 164.312(b)), integrity (§ 164.312(c)), and transmission security (§ 164.312(e)).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NIST SP 800-66 REV 2 SAFEGUARD STACK                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. ACCESS CONTROL (§ 164.312(a)(1) & (a)(2)(iv))                            │
│    • FIDO2 / WebAuthn Hardware Security Key Authentication (AAL3)          │
│    • RBAC Matrix: Medical Director | Activity Lead | Staff | Auditor       │
│    • Non-Extractable WebCrypto AES-256-GCM in Volatile Heap                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. TRANSMISSION SECURITY (§ 164.312(e)(1))                                  │
│    • Zero-Cloud Rendering: Resident data never crosses network interface    │
│    • HSTS Max-Age=63072000; TLS 1.3 Strict; CSP connect-src 'self'         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. AUDIT CONTROLS & LOGGING (§ 164.312(b))                                  │
│    • Structured, Cryptographically Signed Audit Event Pipeline              │
│    • De-identified Metadata Hashing (SHA-256 Resident Pseudonyms)          │
│    • Forwarding to WORM Immutable Storage (S3 Object Lock - Compliance)     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. INTEGRITY & DATA AUTHENTICATION (§ 164.312(c)(1))                        │
│    • AES-GCM 128-bit Authentication Tags verify ciphertext integrity        │
│    • AAD Binds Payload directly to Tenant and Record UUIDs                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Phishing-Resistant FIDO2 / WebAuthn MFA Implementation (NIST SP 800-63B AAL3)
Commercial senior care operators must authenticate staff access to resident profiles and packet generators using phishing-resistant hardware authenticators (YubiKey 5 Series, Apple TouchID/FaceID Secure Enclave, Windows Hello TPM 2.0).

#### Technical Architecture:
1. **Relying Party (RP):** `https://cognicopia.org` (enforcing origin check against domain spoofing).
2. **User Verification (UV):** `userVerification: "required"` (biometric touch or hardware PIN).
3. **Authenticator Attachment:** `authenticatorAttachment: "platform"` or `"cross-platform"`.
4. **Attestation Statement:** Direct attestation validation verifying FIPS-validated AAGUIDs.

```typescript
// WebAuthn Level 3 Registration & Authentication Configuration
export const FIDO2_CONFIG: PublicKeyCredentialCreationOptions = {
  challenge: window.crypto.getRandomValues(new Uint8Array(32)),
  rp: {
    name: "Cognicopia Healthcare Clinical Suite",
    id: "cognicopia.org"
  },
  user: {
    id: window.crypto.getRandomValues(new Uint8Array(16)),
    name: "activity.lead@seniorcare-provider.org",
    displayName: "Lead Activity Director (Station 4)"
  },
  pubKeyCredParams: [
    { type: "public-key", alg: -7 },  // ES256 (NIST P-256 with SHA-256)
    { type: "public-key", alg: -257 } // RS256 (RSA 2048+)
  ],
  authenticatorSelection: {
    authenticatorAttachment: "cross-platform", // FIDO2 Hardware Tokens / YubiKey
    userVerification: "required",             // Biometric or PIN mandatory
    residentKey: "preferred"
  },
  timeout: 60000,
  attestation: "direct"
};
```

---

### 2.2 Role-Based Access Control (RBAC) Matrix

| System Role | Permitted Actions | ePHI Scope | Session Timeout | Key Derivation Rights |
| :--- | :--- | :--- | :--- | :--- |
| **Medical Director / SLP** | Create/Edit Resident Profiles, Access Clinical Assessment Notes, Authorize Caregiver Overrides | Full Facility Access | 15 Minutes Inactivity | Master KEK Unlock & Wrapping |
| **Activity Director / Lead** | Generate Daily Packets, Edit Hobbies/Preferences, Print Multi-Resident Bundles | Assigned Wings / Units | 30 Minutes Inactivity | Active DEK Access |
| **Caregiver / CNA** | View Read-Only Instant Soothe Pages, Print Saved Emergency Activities | Active Shift Resident Only | 15 Minutes Inactivity | Ephemeral Session Access (No Profile Edit) |
| **Compliance Auditor** | View Cryptographic Proof Logs, Audit Ledger, BAA Status | De-Identified Signatures Only | 10 Minutes Inactivity | No DEK Access (Zero ePHI Access) |
| **System Administrator** | Manage Facility Licensing, FIDO2 Key Registrations, Configure Inactivity Timeouts | System Settings Only | 15 Minutes Inactivity | No DEK Access |

---

## SECTION 3: IMMUTABLE AUDIT LOGGING PIPELINE (6-YEAR RETENTION)

HIPAA Security Rule § 164.312(b) and § 164.316(b)(2)(i) require covered entities and business associates to maintain audit logs and operational documentation for a minimum of **six (6) years** from the date of creation.

### 3.1 Immutable WORM Storage Architecture
```
[ Client Workstation ]
        │
        ├─► Event Occurs: (e.g., PACKET_PRINT, RESIDENT_EDIT, AUTH_SUCCESS)
        ├─► Sign Event Locally (Client Ed25519 or HMAC-SHA256)
        ├─► De-Identify: Replace Name with Pseudonym (HMAC(Salt, ResidentID))
        │
        ▼ (TLS 1.3 mTLS Endpoint: /api/v1/audit/ingest)
[ Ingestion Gateway (AWS API Gateway + Lambda Validator) ]
        │
        ├─► Validate Schema & Timestamps
        ├─► Aggregate into Hourly Parquet Batch
        ├─► Calculate Merkle Tree Root Hash
        │
        ▼
[ AWS S3 Glacier Vault (Object Lock in COMPLIANCE Mode) ]
        │
        ├── Retention Period: Exactly 2,192 Days (6 Years)
        ├── S3 Object Lock Mode: COMPLIANCE (Cannot be deleted by AWS Root)
        ├── Encryption: AWS KMS Customer-Managed Key (CMK) / AES-256
        └── Replication: Cross-Region to Secondary Cloud Vault
```

### 3.2 Audit Log Schema Specification
Audit records capture mandatory HIPAA auditing dimensions: Who, What, When, Where, and Outcome—while enforcing de-identification of resident identities:

```typescript
export interface HipaaAuditEvent {
  eventId: string;                  // UUIDv4
  timestampIso: string;             // UTC ISO-8601 (microsecond resolution)
  facilityId: string;               // Multi-tenant facility identifier
  operatorId: string;               // FIDO2 User ID / Staff Account ID
  clientIpHash: string;             // SHA-256(IP + Monthly Salt) to prevent tracking
  userAgent: string;                // Browser client signature
  action: 
    | 'AUTH_LOGIN_SUCCESS' 
    | 'AUTH_LOGIN_FAILURE' 
    | 'SESSION_LOCK_TIMEOUT'
    | 'RESIDENT_PROFILE_CREATE'
    | 'RESIDENT_PROFILE_ACCESS'
    | 'RESIDENT_PROFILE_UPDATE'
    | 'RESIDENT_PROFILE_DELETE'
    | 'PACKET_PRINT_SINGLE'
    | 'PACKET_PRINT_BUNDLE'
    | 'EMERGENCY_SOOTHE_TRIGGER'
    | 'STATION_HANDOFF_EXPORT';
  resourceIdHash: string;           // SHA-256(Resident_UUID + Facility_Salt)
  cognitiveTierSnapshot: 'Mild' | 'Moderate' | 'Advanced';
  pageCount: number;                // Number of pages generated/printed
  cryptoVerificationStatus: 'VALID' | 'SIGNATURE_MISMATCH' | 'AAD_REJECTED';
  signature: string;                // Hex-encoded cryptographic signature
}
```

---

## SECTION 4: INCIDENT RESPONSE & 60-DAY BREACH NOTIFICATION PROTOCOL

Compliant with HHS Office for Civil Rights (OCR) Enforcement Rule and 45 CFR §§ 164.400–414.

### 4.1 Four-Factor Risk Assessment Protocol (§ 164.402)
Under HIPAA, any unauthorized acquisition, access, use, or disclosure of ePHI is presumed to be a breach unless Business Associate or Covered Entity demonstrates a low probability that the ePHI has been compromised based on a mandatory four-factor risk assessment:
1. **Factor 1:** The nature and extent of the PHI involved, including the types of identifiers and likelihood of re-identification.
2. **Factor 2:** The unauthorized person who used the PHI or to whom the disclosure was made.
3. **Factor 3:** Whether the PHI was actually acquired or viewed.
4. **Factor 4:** The extent to which the risk to the PHI has been mitigated.

*Architectural Safe Harbor:* If data compromised was encrypted using **AES-256-GCM** with a non-compromised key held in browser memory, the data is deemed **Secured PHI** under HITECH § 13402(h)(2), and the event does not constitute a Breach of Unsecured PHI requiring notification.

---

### 4.2 60-Day OCR Incident Response Timeline

```
T=0 Hours: Incident Detected / Reported
 │
 ├── Within 24 Hours: 
 │   • Invoke Incident Response Team (Legal, CISO, Clinical Director).
 │   • Isolate affected client endpoints and rotate all facility passphrase rings.
 │
 ├── Within 72 Hours:
 │   • Complete Four-Factor Risk Assessment.
 │   • Determine if unencrypted or secured PHI was exposed.
 │
 ├── Within 10 Calendar Days:
 │   • Formal written report delivered to Covered Entity Privacy Officer.
 │   • Log forensics, memory dumps, and audit ledger excerpts provided.
 │
 ├── Days 11 - 45:
 │   • Coordination with Covered Entity regarding affected resident families.
 │   • Remediation of client environment / software patch verification.
 │
 └── Prior to Day 60 (Strict Statutory Deadline under 45 CFR § 164.404):
     • Covered Entity notifies affected individuals (or next-of-kin / legal guardians).
     • Notification submitted to HHS Secretary via OCR Breach Reporting Portal.
     • If breach affects >500 residents: Notice dispatched to prominent media outlets.
```

---

## SECTION 5: OPERATIONAL READINESS & CERTIFICATION CHECKLIST

- [x] **BAA Automation:** Automated counter-signing workflow enabled for enterprise licensing.
- [x] **NIST SP 800-66 Rev 2 Alignment:** All administrative, physical, and technical safeguards cross-referenced.
- [x] **FIDO2 / WebAuthn Configuration:** Ready for WebAuthn Level 3 hardware token integration.
- [x] **Zero-Cloud Enforcement:** Network boundaries verified (`Net.requests() === 0` on resident tools).
- [x] **6-Year Immutable Audit Logging:** S3 Object Lock Parquet schema compiled and verified.
- [x] **60-Day Breach Notification Protocol:** Formalized with OCR 4-factor risk assessment checklists.
