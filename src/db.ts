import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Transaction } from './types';

interface VibeLedgerDB extends DBSchema {
  transactions: {
    key: string;
    value: Transaction;
    indexes: { 
      'by-date': string;
      'by-category': string;
      'by-type': string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<VibeLedgerDB>>;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<VibeLedgerDB>('vibe-ledger-db', 2, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        let store;
        if (oldVersion < 1) {
          store = db.createObjectStore('transactions', {
            keyPath: 'id',
          });
          store.createIndex('by-date', 'date');
        } else {
          store = transaction.objectStore('transactions');
        }

        // Migration to Schema v2: Multi-index support
        if (oldVersion < 2) {
          if (!store.indexNames.contains('by-category')) {
            store.createIndex('by-category', 'category');
          }
          if (!store.indexNames.contains('by-type')) {
            store.createIndex('by-type', 'type');
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

