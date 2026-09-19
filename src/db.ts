import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Transaction, AssetAccount } from './types';

export const INITIAL_ASSET_ACCOUNTS: AssetAccount[] = [
  {
    id: 'account-toss-sec',
    institution: '토스증권',
    accountName: '토스 해외/국내 종합주식',
    assetType: 'BROKERAGE',
    currentBalance: 12500000,
    currency: 'KRW',
    lastUpdated: new Date().toISOString(),
    accountNumberMasked: '토스 ***-***-1234',
    note: 'S&P 500 ETF, 테크주 포트폴리오'
  },
  {
    id: 'account-kakao-sec',
    institution: '카카오페이증권',
    accountName: '카카오 국내 배당 ISA',
    assetType: 'BROKERAGE',
    currentBalance: 4800000,
    currency: 'KRW',
    lastUpdated: new Date().toISOString(),
    accountNumberMasked: '카카오증권 ***-**-5678',
    note: '국내 고배당주 및 미국 배당다우존스'
  },
  {
    id: 'account-kakaobank',
    institution: '카카오뱅크',
    accountName: '주거래 급여/생활비 통장',
    assetType: 'BANK',
    currentBalance: 3200000,
    currency: 'KRW',
    lastUpdated: new Date().toISOString(),
    accountNumberMasked: '카카오뱅크 3333-**-****',
    note: '급여 및 자동이체 계좌'
  },
  {
    id: 'account-upbit-crypto',
    institution: '업비트',
    accountName: '가상자산 포트폴리오',
    assetType: 'CRYPTO',
    currentBalance: 2150000,
    currency: 'KRW',
    lastUpdated: new Date().toISOString(),
    note: '비트코인, 이더리움 적립식'
  },
  {
    id: 'account-cash',
    institution: '현금/비상금',
    accountName: '자택 비상금 금고',
    assetType: 'CASH',
    currentBalance: 500000,
    currency: 'KRW',
    lastUpdated: new Date().toISOString(),
    note: '비상용 현금'
  }
];

interface VibeVaultDB extends DBSchema {
  transactions: {
    key: string;
    value: Transaction;
    indexes: { 
      'by-date': string;
      'by-category': string;
      'by-type': string;
    };
  };
  assetAccounts: {
    key: string;
    value: AssetAccount;
    indexes: {
      'by-type': string;
      'by-institution': string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<VibeVaultDB>>;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<VibeVaultDB>('vibe-vault-db', 3, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        let txStore;
        if (oldVersion < 1) {
          txStore = db.createObjectStore('transactions', {
            keyPath: 'id',
          });
          txStore.createIndex('by-date', 'date');
        } else {
          txStore = transaction.objectStore('transactions');
        }

        // Migration to Schema v2: Multi-index support
        if (oldVersion < 2) {
          if (!txStore.indexNames.contains('by-category')) {
            txStore.createIndex('by-category', 'category');
          }
          if (!txStore.indexNames.contains('by-type')) {
            txStore.createIndex('by-type', 'type');
          }
        }

        // Migration to Schema v3: Multi-Brokerage Asset Accounts Store
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('assetAccounts')) {
            const assetStore = db.createObjectStore('assetAccounts', {
              keyPath: 'id',
            });
            assetStore.createIndex('by-type', 'assetType');
            assetStore.createIndex('by-institution', 'institution');
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function addTransaction(transaction: Transaction) {
  const db = await getDB();
  await db.add('transactions', transaction);
}

export async function addTransactions(transactions: Transaction[]) {
  const db = await getDB();
  const tx = db.transaction('transactions', 'readwrite');
  for (const t of transactions) {
    tx.store.put(t);
  }
  await tx.done;
}

export async function replaceAllTransactions(transactions: Transaction[]) {
  const db = await getDB();
  const tx = db.transaction('transactions', 'readwrite');
  await tx.store.clear();
  for (const t of transactions) {
    tx.store.put(t);
  }
  await tx.done;
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const db = await getDB();
  const txs = await db.getAllFromIndex('transactions', 'by-date');
  return txs.reverse(); // newest first
}

export async function deleteTransaction(id: string) {
  const db = await getDB();
  await db.delete('transactions', id);
}

export async function updateTransaction(transaction: Transaction) {
  const db = await getDB();
  await db.put('transactions', transaction);
}

export async function clearAllTransactions() {
  const db = await getDB();
  await db.clear('transactions');
}

/**
 * Differential Query: Retrieves records on or after a given ISO timestamp
 * Used for differential cloud sync and incremental backups.
 */
export async function getTransactionsSince(sinceIsoDate: string): Promise<Transaction[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('transactions', 'by-date');
  return all.filter(t => t.date >= sinceIsoDate).reverse();
}

/**
 * Filtered queries using IndexedDB secondary indexes
 */
export async function getTransactionsByCategory(category: string): Promise<Transaction[]> {
  const db = await getDB();
  return db.getAllFromIndex('transactions', 'by-category', category);
}

export async function getTransactionsByType(type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'SETTLEMENT'): Promise<Transaction[]> {
  const db = await getDB();
  return db.getAllFromIndex('transactions', 'by-type', type);
}

/**
 * Multi-Brokerage Asset Account Persistence
 */
export async function getAllAssetAccounts(): Promise<AssetAccount[]> {
  const db = await getDB();
  const accounts = await db.getAll('assetAccounts');
  if (!accounts || accounts.length === 0) {
    // Seed initial demo/default accounts so new users immediately experience the vault
    const tx = db.transaction('assetAccounts', 'readwrite');
    for (const item of INITIAL_ASSET_ACCOUNTS) {
      tx.store.put(item);
    }
    await tx.done;
    return INITIAL_ASSET_ACCOUNTS;
  }
  return accounts;
}

export async function saveAssetAccount(account: AssetAccount): Promise<void> {
  const db = await getDB();
  await db.put('assetAccounts', account);
}

export async function deleteAssetAccount(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('assetAccounts', id);
}

export async function updateAssetAccountBalance(id: string, newBalance: number): Promise<AssetAccount | null> {
  const db = await getDB();
  const account = await db.get('assetAccounts', id);
  if (!account) return null;

  account.currentBalance = newBalance;
  account.lastUpdated = new Date().toISOString();
  await db.put('assetAccounts', account);
  return account;
}

export async function bulkSaveAssetAccounts(accounts: AssetAccount[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('assetAccounts', 'readwrite');
  for (const acc of accounts) {
    tx.store.put(acc);
  }
  await tx.done;
}

/**
 * Account-to-Account Transfer Execution:
 * Decreases source account balance, increases target account balance,
 * and creates a non-expense TRANSFER transaction in the Ledger.
 */
export async function executeAccountTransfer(
  sourceAccountId: string,
  targetAccountId: string,
  amount: number,
  note?: string
): Promise<{ transaction: Transaction; sourceAccount: AssetAccount; targetAccount: AssetAccount }> {
  if (sourceAccountId === targetAccountId) {
    throw new Error('출금 계좌와 입금 계좌는 서로 달라야 합니다.');
  }
  if (amount <= 0) {
    throw new Error('이체 금액은 0보다 커야 합니다.');
  }

  const db = await getDB();
  const source = await db.get('assetAccounts', sourceAccountId);
  const target = await db.get('assetAccounts', targetAccountId);

  if (!source) throw new Error('출금 계좌를 찾을 수 없습니다.');
  if (!target) throw new Error('입금 계좌를 찾을 수 없습니다.');

  // Adjust balances
  source.currentBalance = Math.max(0, source.currentBalance - amount);
  source.lastUpdated = new Date().toISOString();

  target.currentBalance = target.currentBalance + amount;
  target.lastUpdated = new Date().toISOString();

  const nowIso = new Date().toISOString();
  const transferTx: Transaction = {
    id: `tx-transfer-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'TRANSFER',
    amount: amount,
    currency: source.currency || 'KRW',
    category: 'Fixed',
    subCategory: '자산이체',
    description: note || `${source.institution} ➔ ${target.institution} 계좌이체`,
    date: nowIso,
    paymentMethod: source.institution,
    sourceAccountId: source.id,
    targetAccountId: target.id,
    isInternalTransfer: true,
  };

  // Perform atomic multi-store write
  const tx = db.transaction(['assetAccounts', 'transactions'], 'readwrite');
  tx.objectStore('assetAccounts').put(source);
  tx.objectStore('assetAccounts').put(target);
  tx.objectStore('transactions').put(transferTx);
  await tx.done;

  return { transaction: transferTx, sourceAccount: source, targetAccount: target };
}


