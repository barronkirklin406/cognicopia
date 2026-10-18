/**
 * @file secureCryptoStore.ts
 * @description Production-ready Native Web Cryptography API wrapper (AES-256-GCM + PBKDF2)
 * paired with IndexedDB for Zero-Cloud ePHI storage and automated session purges.
 * Standard: HIPAA Security Rule (§ 164.312(a)(2)(iv)), NIST SP 800-38D, NIST SP 800-132.
 * @global CogniSecureCryptoStore
 */

export interface ResidentProfile {
  id: string;
  firstName: string;
  lastName?: string;
  preferredName?: string;
  roomOrWing?: string;
  birthYear?: number;
  cognitiveTier: 'Mild' | 'Moderate' | 'Advanced';
  hometown?: string;
  pastOccupation?: string;
  hobbies?: string[];
  interests?: string[];
  favoriteMusicOrEra?: string;
  avoidTopics?: string[];
  notes?: string;
  updatedAt: number;
}

export interface EncryptedRecord {
  id: string;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
  version: number;
  updatedAt: number;
}

export interface WrappedKeyRecord {
  id: string;
  salt: Uint8Array;
  iterations: number;
  iv: Uint8Array;
  wrappedKey: ArrayBuffer;
  createdAt: number;
  updatedAt: number;
}

export interface CryptoStoreConfig {
  dbName?: string;
  dbVersion?: number;
  pbkdf2Iterations?: number;
  inactivityTimeoutMinutes?: number;
  onSessionTimeout?: () => void;
}

const DEFAULT_DB_NAME = 'CognicopiaSecureDB_v2';
const DEFAULT_DB_VERSION = 1;
const DEFAULT_ITERATIONS = 600_000;
const DEFAULT_INACTIVITY_MINUTES = 60; // 1 hour default session

const STORE_KEYRING = 'keyring';
const STORE_RESIDENTS = 'residents';
const STORE_PACKETS = 'packets';
const STORE_BLOBS = 'blobs';

export class SecureCryptoStore {
  private db: IDBDatabase | null = null;
  private activeDek: CryptoKey | null = null;
  private sessionTimer: number | null = null;
  private lastActivityTimestamp: number = Date.now();
  private readonly config: Required<CryptoStoreConfig>;
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();

  constructor(config: CryptoStoreConfig = {}) {
    this.config = {
      dbName: config.dbName ?? DEFAULT_DB_NAME,
      dbVersion: config.dbVersion ?? DEFAULT_DB_VERSION,
      pbkdf2Iterations: config.pbkdf2Iterations ?? DEFAULT_ITERATIONS,
      inactivityTimeoutMinutes: config.inactivityTimeoutMinutes ?? DEFAULT_INACTIVITY_MINUTES,
      onSessionTimeout: config.onSessionTimeout ?? (() => {}),
    };
    this.bindActivityListeners();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle & Database Initialization
  // ---------------------------------------------------------------------------

  public async open(): Promise<void> {
    if (this.db) return;
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
      throw new Error('Web Cryptography API (crypto.subtle) is not supported in this environment.');
    }
    if (!window.indexedDB) {
      throw new Error('IndexedDB is not supported in this environment.');
    }

    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_KEYRING)) {
          db.createObjectStore(STORE_KEYRING, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_RESIDENTS)) {
          db.createObjectStore(STORE_RESIDENTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PACKETS)) {
          db.createObjectStore(STORE_PACKETS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    });
  }

  public isUnlocked(): boolean {
    return this.activeDek !== null;
  }

  // ---------------------------------------------------------------------------
  // Key Derivation & Wrapping Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Unlocks an existing database with passphrase or initializes a new wrapped DEK.
   */
  public async unlockWithPassphrase(passphrase: string): Promise<boolean> {
    await this.open();
    if (!this.db) throw new Error('Database not initialized');

    const keyringRecord = await this.getKeyringRecord();

    if (!keyringRecord) {
      // First time initialization: generate master DEK and wrap with derived KEK
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const kek = await this.deriveKek(passphrase, salt, this.config.pbkdf2Iterations);

      // Generate random 256-bit AES-GCM Data Encryption Key (non-extractable)
      const rawDek = window.crypto.getRandomValues(new Uint8Array(32));
      const wrapIv = window.crypto.getRandomValues(new Uint8Array(12));

      const wrappedKeyBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: wrapIv },
        kek,
        rawDek.buffer
      );

      const newKeyringRecord: WrappedKeyRecord = {
        id: 'master_dek',
        salt,
        iterations: this.config.pbkdf2Iterations,
        iv: wrapIv,
        wrappedKey: wrappedKeyBuffer,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await this.saveKeyringRecord(newKeyringRecord);

      // Import active DEK into memory with extractable: false
      this.activeDek = await window.crypto.subtle.importKey(
        'raw',
        rawDek.buffer,
        { name: 'AES-GCM', length: 256 },
        false, // Crucial: non-extractable in memory
        ['encrypt', 'decrypt']
      );

      this.resetInactivityTimer();
      return true;
    }

    // Existing keyring: derive KEK using stored salt and unwrap DEK
    try {
      const kek = await this.deriveKek(passphrase, keyringRecord.salt, keyringRecord.iterations);
      const rawDekBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: keyringRecord.iv },
        kek,
        keyringRecord.wrappedKey
      );

      this.activeDek = await window.crypto.subtle.importKey(
        'raw',
        rawDekBuffer,
        { name: 'AES-GCM', length: 256 },
        false, // Crucial: non-extractable in memory
        ['encrypt', 'decrypt']
      );

      this.resetInactivityTimer();
      return true;
    } catch {
      return false; // Invalid passphrase or corrupted keyring
    }
  }

  private async deriveKek(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
    const rawPass = this.encoder.encode(passphrase);
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      rawPass,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: salt.buffer,
        iterations,
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false, // KEK is also non-extractable
      ['encrypt', 'decrypt']
    );
  }

  // ---------------------------------------------------------------------------
  // Inactivity & Session Purge Management
  // ---------------------------------------------------------------------------

  public touchActivity(): void {
    this.lastActivityTimestamp = Date.now();
  }

  private bindActivityListeners(): void {
    if (typeof window === 'undefined') return;
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => {
      window.addEventListener(ev, () => this.touchActivity(), { passive: true });
    });
    window.addEventListener('beforeunload', () => this.lock());
    window.addEventListener('pagehide', () => this.lock());
  }

  private resetInactivityTimer(): void {
    if (this.sessionTimer !== null) {
      window.clearInterval(this.sessionTimer);
    }

    const checkIntervalMs = 15_000; // Check every 15 seconds
    const timeoutMs = this.config.inactivityTimeoutMinutes * 60 * 1000;

    this.sessionTimer = window.setInterval(() => {
      const elapsed = Date.now() - this.lastActivityTimestamp;
      if (elapsed >= timeoutMs) {
        this.lock();
        this.config.onSessionTimeout();
      }
    }, checkIntervalMs);
  }

  /**
   * Explicitly locks the session, purging the DEK from volatile browser memory.
   */
  public lock(): void {
    this.activeDek = null;
    if (this.sessionTimer !== null) {
      window.clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Encrypted CRUD Operations for Resident Profiles
  // ---------------------------------------------------------------------------

  public async saveResident(profile: ResidentProfile): Promise<void> {
    if (!this.activeDek) throw new Error('Store is locked. Please authenticate first.');
    if (!profile.id) throw new Error('ResidentProfile requires a valid id.');

    profile.updatedAt = Date.now();
    const plaintextBytes = this.encoder.encode(JSON.stringify(profile));

    // NIST SP 800-38D: 12-byte unique IV per encryption operation
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // AAD: Bind ciphertext to the record ID to prevent swap attacks
    const aad = this.encoder.encode(`resident:${profile.id}`);

    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: aad,
        tagLength: 128,
      },
      this.activeDek,
      plaintextBytes
    );

    const record: EncryptedRecord = {
      id: profile.id,
      iv,
      ciphertext,
      version: 1,
      updatedAt: profile.updatedAt,
    };

    await this.putRecord(STORE_RESIDENTS, record);
    this.touchActivity();
  }

  public async getResident(id: string): Promise<ResidentProfile | null> {
    if (!this.activeDek) throw new Error('Store is locked. Please authenticate first.');

    const record = await this.getRecord<EncryptedRecord>(STORE_RESIDENTS, id);
    if (!record) return null;

    const aad = this.encoder.encode(`resident:${id}`);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: record.iv,
        additionalData: aad,
        tagLength: 128,
      },
      this.activeDek,
      record.ciphertext
    );

    this.touchActivity();
    const jsonStr = this.decoder.decode(decryptedBuffer);
    return JSON.parse(jsonStr) as ResidentProfile;
  }

  public async listResidents(): Promise<ResidentProfile[]> {
    if (!this.activeDek) throw new Error('Store is locked. Please authenticate first.');

    const records = await this.getAllRecords<EncryptedRecord>(STORE_RESIDENTS);
    const profiles: ResidentProfile[] = [];

    for (const record of records) {
      try {
        const aad = this.encoder.encode(`resident:${record.id}`);
        const decrypted = await window.crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: record.iv,
            additionalData: aad,
            tagLength: 128,
          },
          this.activeDek,
          record.ciphertext
        );
        profiles.push(JSON.parse(this.decoder.decode(decrypted)));
      } catch (err) {
        console.error(`Decryption failed for resident ${record.id}:`, err);
      }
    }

    this.touchActivity();
    return profiles.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
  }

  public async deleteResident(id: string): Promise<void> {
    if (!this.activeDek) throw new Error('Store is locked. Please authenticate first.');
    await this.deleteRecord(STORE_RESIDENTS, id);
    this.touchActivity();
  }

  /**
   * Irreversibly purges all local databases and caches (Emergency facility reset).
   */
  public async purgeAllData(): Promise<void> {
    this.lock();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(this.config.dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('Failed to delete database'));
    });
  }

  // ---------------------------------------------------------------------------
  // Low-Level IndexedDB Promise Helpers
  // ---------------------------------------------------------------------------

  private async getKeyringRecord(): Promise<WrappedKeyRecord | null> {
    return this.getRecord<WrappedKeyRecord>(STORE_KEYRING, 'master_dek');
  }

  private async saveKeyringRecord(record: WrappedKeyRecord): Promise<void> {
    return this.putRecord(STORE_KEYRING, record);
  }

  private getRecord<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
    if (!this.db) throw new Error('Database is closed');
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  private getAllRecords<T>(storeName: string): Promise<T[]> {
    if (!this.db) throw new Error('Database is closed');
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  private putRecord(storeName: string, value: unknown): Promise<void> {
    if (!this.db) throw new Error('Database is closed');
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private deleteRecord(storeName: string, key: IDBValidKey): Promise<void> {
    if (!this.db) throw new Error('Database is closed');
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
