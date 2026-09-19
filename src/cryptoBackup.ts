import { Transaction, EncryptedBackupPayload, UnencryptedBackupPayloadV2 } from './types';

/**
 * ArrayBuffer <-> Hex / Base64 conversion helpers
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives AES-GCM 256 key from passphrase and salt using PBKDF2-SHA-256 (100,000 rounds)
 */
async function deriveKey(passphrase: string, saltBuffer: ArrayBuffer, iterations: number = 100000): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts backup data with AES-GCM-256 using password
 */
export async function encryptBackupData(
  payload: UnencryptedBackupPayloadV2,
  passphrase: string
): Promise<EncryptedBackupPayload> {
  if (!passphrase || passphrase.trim().length === 0) {
    throw new Error('암호화 비밀번호를 입력해주세요.');
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const iterations = 100000;

  const key = await deriveKey(passphrase, salt.buffer, iterations);
  const enc = new TextEncoder();
  const encodedData = enc.encode(JSON.stringify(payload));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    encodedData
  );

  return {
    version: '2.0',
    format: 'vibe-encrypted-v2',
    kdf: 'PBKDF2',
    cipher: 'AES-GCM-256',
    iterations,
    salt: bufferToHex(salt.buffer),
    iv: bufferToHex(iv.buffer),
    ciphertext: bufferToBase64(encryptedBuffer),
    createdAt: new Date().toISOString(),
    meta: {
      transactionCount: payload.transactions?.length || 0,
      appName: 'Vibe Ledger Pro'
    }
  };
}

/**
 * Decrypts AES-GCM encrypted backup payload with password
 */
export async function decryptBackupData(
  encryptedPayload: EncryptedBackupPayload,
  passphrase: string
): Promise<UnencryptedBackupPayloadV2> {
  if (!passphrase) {
    throw new Error('복호화 비밀번호를 입력해주세요.');
  }

  try {
    const saltBuffer = hexToBuffer(encryptedPayload.salt);
    const ivBuffer = hexToBuffer(encryptedPayload.iv);
    const ciphertextBuffer = base64ToBuffer(encryptedPayload.ciphertext);
    const iterations = encryptedPayload.iterations || 100000;

    const key = await deriveKey(passphrase, saltBuffer, iterations);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(ivBuffer)
      },
      key,
      ciphertextBuffer
    );

    const dec = new TextDecoder();
    const jsonStr = dec.decode(decryptedBuffer);
    return JSON.parse(jsonStr) as UnencryptedBackupPayloadV2;
  } catch (err: any) {
    throw new Error('비밀번호가 올바르지 않거나 백업 파일이 손상되었습니다.');
  }
}

/**
 * Smart Differential Merge Utility
 * Merges imported transactions with existing records, deduplicating by ID or timestamp+amount+description.
 */
export function mergeTransactionsDeduplicated(
  existingList: Transaction[],
  incomingList: Transaction[],
  mode: 'merge' | 'overwrite' = 'merge'
): {
  finalTransactions: Transaction[];
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
} {
  if (mode === 'overwrite') {
    return {
      finalTransactions: incomingList,
      addedCount: incomingList.length,
      updatedCount: 0,
      skippedCount: 0
    };
  }

  const existingMap = new Map<string, Transaction>();
  const contentFingerprints = new Set<string>();

  for (const t of existingList) {
    existingMap.set(t.id, t);
    // Fingerprint: date_minute + amount + description
    const dateMinute = t.date ? t.date.substring(0, 16) : '';
    const fp = `${dateMinute}_${t.amount}_${t.description.trim().toLowerCase()}`;
    contentFingerprints.add(fp);
  }

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  const resultList = [...existingList];

  for (const incoming of incomingList) {
    if (existingMap.has(incoming.id)) {
      // Update existing item
      const idx = resultList.findIndex(t => t.id === incoming.id);
      if (idx >= 0) {
        resultList[idx] = incoming;
        updatedCount++;
      }
    } else {
      const incomingMinute = incoming.date ? incoming.date.substring(0, 16) : '';
      const fp = `${incomingMinute}_${incoming.amount}_${incoming.description.trim().toLowerCase()}`;
      if (contentFingerprints.has(fp)) {
        // Skip duplicate identical transaction
        skippedCount++;
      } else {
        resultList.push(incoming);
        contentFingerprints.add(fp);
        addedCount++;
      }
    }
  }

  // Sort newest first
  resultList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    finalTransactions: resultList,
    addedCount,
    updatedCount,
    skippedCount
  };
}
