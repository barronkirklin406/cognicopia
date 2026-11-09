/**
 * @file immutableAuditLogger.ts
 * @description Production-grade audit logger that supports a facility's HIPAA privacy practices, following NIST SP 800-66 Rev 2 guidance
 * and 45 CFR § 164.312(b). Hashes resident identifiers into de-identified pseudonyms,
 * signs entries locally, and queues them for WORM immutable storage (e.g., S3 Glacier Object Lock).
 * @global CogniImmutableAuditLogger
 */

export type AuditAction =
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

export interface AuditRecord {
  eventId: string;
  timestampIso: string;
  facilityId: string;
  operatorId: string;
  action: AuditAction;
  resourceIdHash: string; // SHA-256 de-identified pseudonym
  details: Record<string, unknown>;
  signature: string;
}

export class ImmutableAuditLogger {
  private readonly facilityId: string;
  private readonly facilitySalt: string;
  private readonly queueKey: string = 'cognicopia_audit_queue';
  private readonly encoder = new TextEncoder();

  constructor(facilityId: string, facilitySalt: string) {
    this.facilityId = facilityId;
    this.facilitySalt = facilitySalt;
  }

  /**
   * Hashes resident ID into a one-way de-identified pseudonym compliant with HIPAA Safe Harbor.
   */
  public async pseudonymize(residentId: string): Promise<string> {
    if (!residentId) return 'ANONYMOUS_OR_GENERAL';
    const data = this.encoder.encode(`${residentId}:${this.facilitySalt}:${this.facilityId}`);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Computes an HMAC-SHA256 signature over the audit event payload to verify tampering.
   */
  private async signPayload(rawPayload: string): Promise<string> {
    const keyData = this.encoder.encode(this.facilitySalt);
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sigBuffer = await window.crypto.subtle.sign('HMAC', cryptoKey, this.encoder.encode(rawPayload));
    return Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Records a mandatory security event, signs it, and writes to the local queue.
   */
  public async logEvent(
    operatorId: string,
    action: AuditAction,
    residentId: string,
    details: Record<string, unknown> = {}
  ): Promise<AuditRecord> {
    const eventId = window.crypto.randomUUID ? window.crypto.randomUUID() : `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timestampIso = new Date().toISOString();
    const resourceIdHash = await this.pseudonymize(residentId);

    const baseRecord = {
      eventId,
      timestampIso,
      facilityId: this.facilityId,
      operatorId,
      action,
      resourceIdHash,
      details,
    };

    const signature = await this.signPayload(JSON.stringify(baseRecord));
    const fullRecord: AuditRecord = {
      ...baseRecord,
      signature,
    };

    this.persistToQueue(fullRecord);
    return fullRecord;
  }

  private persistToQueue(record: AuditRecord): void {
    try {
      const existingJson = localStorage.getItem(this.queueKey);
      const queue: AuditRecord[] = existingJson ? JSON.parse(existingJson) : [];
      queue.push(record);
      // Keep up to 5,000 local events in client ring-buffer before upload
      if (queue.length > 5000) queue.shift();
      localStorage.setItem(this.queueKey, JSON.stringify(queue));
    } catch (e) {
      console.warn('Could not persist audit record to localStorage ring buffer:', e);
    }
  }

  /**
   * Exports queued audit records for batch transmission to AWS S3 Glacier Object Lock.
   */
  public getQueuedRecords(): AuditRecord[] {
    try {
      const existingJson = localStorage.getItem(this.queueKey);
      return existingJson ? JSON.parse(existingJson) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clears acknowledged audit records up to a specific event ID.
   */
  public acknowledgeRecords(lastEventId: string): void {
    try {
      const records = this.getQueuedRecords();
      const idx = records.findIndex((r) => r.eventId === lastEventId);
      if (idx >= 0) {
        const remaining = records.slice(idx + 1);
        localStorage.setItem(this.queueKey, JSON.stringify(remaining));
      }
    } catch (e) {
      console.error('Failed to acknowledge audit records:', e);
    }
  }
}
