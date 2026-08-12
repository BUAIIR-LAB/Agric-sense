import * as SQLite from 'expo-sqlite';
import type { ChatMessage, DiagnosisRecord, FarmerProfile, SpectroscopyRecord } from '@/context/AppContext';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Initializes the database connection once.
 * Uses a singleton promise to prevent race conditions during app startup.
 */
export const initDB = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('📂 Opening SQLite database: agrisense.db');
      const database = await SQLite.openDatabaseAsync('agrisense.db');
      
      // Initialize tables
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        
        CREATE TABLE IF NOT EXISTS profile (
          id TEXT PRIMARY KEY,
          profile_json TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          message_json TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS diagnosis_records (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          record_json TEXT NOT NULL,
          sync_status INTEGER DEFAULT 0
        );
        
        CREATE TABLE IF NOT EXISTS spectroscopy_records (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          record_json TEXT NOT NULL
        );
      `);
      
      // Migration: Add sync_status to diagnosis_records if missing from existing databases
      try {
        await database.execAsync(`
          ALTER TABLE diagnosis_records ADD COLUMN sync_status INTEGER DEFAULT 0;
        `);
        console.log('✅ SQLite: Migrated diagnosis_records with sync_status column');
      } catch (e) {
        // Column likely already exists, ignore
        if (__DEV__) console.log('ℹ️ SQLite: sync_status column already exists or migration skipped');
      }
      
      db = database;
      console.log('✅ SQLite database initialized successfully');
      return database;
    } catch (error) {
      initPromise = null; // Allow retry on failure
      console.error('❌ Failed to initialize SQLite tables:', error);
      throw error;
    }
  })();

  return initPromise;
};

/**
 * Helper to ensure we always have an initialized database instance.
 */
const getDB = async (): Promise<SQLite.SQLiteDatabase | null> => {
  try {
    return await initDB();
  } catch (e) {
    return null;
  }
};

// Global write queue to prevent re-entrant transaction errors (cannot start transaction within transaction)
let writeQueue = Promise.resolve();

/**
 * Wraps an operation in a sequential execute queue.
 */
const queueWrite = async <T>(operation: () => Promise<T>): Promise<T> => {
  const next = writeQueue.then(operation);
  writeQueue = next.then(() => {}).catch(() => {});
  return next;
};

// Profile Sync
export const setProfileDB = async (profile: FarmerProfile | undefined) => {
  return queueWrite(async () => {
    const _db = await getDB();
    if (!_db) return;
    try {
      if (profile) {
        await _db.runAsync(
          'INSERT OR REPLACE INTO profile (id, profile_json) VALUES (?, ?)',
          ['main_profile', JSON.stringify(profile)]
        );
      } else {
        await _db.runAsync('DELETE FROM profile WHERE id = ?', ['main_profile']);
      }
    } catch (e) {
      console.warn('SQLite Error saving profile:', e);
    }
  });
};

export const getProfileDB = async (): Promise<FarmerProfile | undefined> => {
  const _db = await getDB();
  if (!_db) return undefined;
  try {
    const row = await _db.getFirstAsync<{ profile_json: string }>('SELECT profile_json FROM profile WHERE id = ?', ['main_profile']);
    if (row && row.profile_json) {
      return JSON.parse(row.profile_json) as FarmerProfile;
    }
  } catch (e) {
    console.warn('SQLite Error loading profile:', e);
  }
  return undefined;
};

// Chat Sync
export const setChatHistoryDB = async (history: ChatMessage[]) => {
  return queueWrite(async () => {
    const _db = await getDB();
    if (!_db) return;
    try {
      await _db.withTransactionAsync(async () => {
        await _db.runAsync('DELETE FROM chat_messages');
        if (history.length === 0) return;
        
        const stmt = await _db.prepareAsync('INSERT INTO chat_messages (id, timestamp, message_json) VALUES (?, ?, ?)');
        for (const msg of history) {
          await stmt.executeAsync([msg.id, msg.timestamp, JSON.stringify(msg)]);
        }
        await stmt.finalizeAsync();
      });
    } catch (e) {
      console.warn('SQLite Error saving chat history:', e);
    }
  });
};

export const getChatHistoryDB = async (): Promise<ChatMessage[]> => {
  const _db = await getDB();
  if (!_db) return [];
  try {
    const rows = await _db.getAllAsync<{ message_json: string }>('SELECT message_json FROM chat_messages ORDER BY timestamp ASC');
    return rows.map(r => JSON.parse(r.message_json) as ChatMessage);
  } catch (e) {
    console.warn('SQLite Error loading chat history:', e);
    return [];
  }
};

// Diagnosis Sync
export const setDiagnosisHistoryDB = async (history: DiagnosisRecord[]) => {
  return queueWrite(async () => {
    const _db = await getDB();
    if (!_db) return;
    try {
      await _db.withTransactionAsync(async () => {
      await _db.runAsync('DELETE FROM diagnosis_records');
      if (history.length === 0) return;
      
      const stmt = await _db.prepareAsync('INSERT INTO diagnosis_records (id, timestamp, record_json, sync_status) VALUES (?, ?, ?, ?)');
      for (const rec of history) {
        await stmt.executeAsync([rec.id, rec.timestamp, JSON.stringify(rec), rec.syncStatus ?? 0]);
      }
      await stmt.finalizeAsync();
    });
    } catch (e) {
      console.warn('SQLite Error saving diagnoses:', e);
    }
  });
};

export const getDiagnosisHistoryDB = async (): Promise<DiagnosisRecord[]> => {
  const _db = await getDB();
  if (!_db) return [];
  try {
    const rows = await _db.getAllAsync<{ record_json: string, sync_status: number }>('SELECT record_json, sync_status FROM diagnosis_records ORDER BY timestamp DESC');
    return rows.map(r => ({
      ...(JSON.parse(r.record_json) as DiagnosisRecord),
      syncStatus: r.sync_status
    }));
  } catch (e) {
    console.warn('SQLite Error loading diagnoses:', e);
    return [];
  }
};

/**
 * Retrieves only records that haven't been synced to the server yet.
 */
export const getPendingDiagnosesDB = async (): Promise<DiagnosisRecord[]> => {
  const _db = await getDB();
  if (!_db) return [];
  try {
    const rows = await _db.getAllAsync<{ record_json: string, sync_status: number }>(
      'SELECT record_json, sync_status FROM diagnosis_records WHERE sync_status = 1 ORDER BY timestamp ASC'
    );
    return rows.map(r => ({
      ...(JSON.parse(r.record_json) as DiagnosisRecord),
      syncStatus: r.sync_status
    }));
  } catch (e) {
    console.warn('SQLite Error loading pending diagnoses:', e);
    return [];
  }
};

// Spectroscopy Sync
export const setSpectroscopyHistoryDB = async (history: SpectroscopyRecord[]) => {
  return queueWrite(async () => {
    const _db = await getDB();
    if (!_db) return;
    try {
      await _db.withTransactionAsync(async () => {
        await _db.runAsync('DELETE FROM spectroscopy_records');
        if (history.length === 0) return;
        
        const stmt = await _db.prepareAsync('INSERT INTO spectroscopy_records (id, timestamp, record_json) VALUES (?, ?, ?)');
        for (const rec of history) {
          await stmt.executeAsync([rec.id, rec.timestamp, JSON.stringify(rec)]);
        }
        await stmt.finalizeAsync();
      });
    } catch (e) {
      console.warn('SQLite Error saving spectroscopy:', e);
    }
  });
};

export const getSpectroscopyHistoryDB = async (): Promise<SpectroscopyRecord[]> => {
  const _db = await getDB();
  if (!_db) return [];
  try {
    const rows = await _db.getAllAsync<{ record_json: string }>('SELECT record_json FROM spectroscopy_records ORDER BY timestamp DESC');
    return rows.map(r => JSON.parse(r.record_json) as SpectroscopyRecord);
  } catch (e) {
    console.warn('SQLite Error loading spectroscopy:', e);
    return [];
  }
};

// Master Wipe
export const clearAllDB = async () => {
  return queueWrite(async () => {
    const _db = await getDB();
    if (!_db) return;
    try {
      await _db.execAsync(`
        DELETE FROM profile;
        DELETE FROM chat_messages;
        DELETE FROM diagnosis_records;
        DELETE FROM spectroscopy_records;
      `);
    } catch (e) {
      console.warn('SQLite Error clearing DB:', e);
    }
  });
};
