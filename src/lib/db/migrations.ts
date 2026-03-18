import { turso } from './client'

let migrationRan = false

export async function runMigrations(): Promise<void> {
  if (migrationRan) return
  migrationRan = true

  try {
    await turso.executeMultiple(`
      CREATE TABLE IF NOT EXISTS exercises (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mainPrompt TEXT,
        isActive INTEGER NOT NULL DEFAULT 0,
        currentPhase INTEGER NOT NULL DEFAULT 1,
        timerEndsAt TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS jtbd_entries (
        id TEXT PRIMARY KEY,
        exerciseId TEXT NOT NULL,
        userId TEXT NOT NULL,
        userEmail TEXT NOT NULL,
        userName TEXT,
        situation TEXT NOT NULL,
        motivation TEXT NOT NULL,
        expectedOutcome TEXT NOT NULL,
        fullSentence TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (exerciseId) REFERENCES exercises(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS vote_transactions (
        id TEXT PRIMARY KEY,
        exerciseId TEXT NOT NULL,
        entryId TEXT NOT NULL,
        userId TEXT NOT NULL,
        action TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (exerciseId) REFERENCES exercises(id) ON DELETE CASCADE,
        FOREIGN KEY (entryId) REFERENCES jtbd_entries(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_entries_exercise ON jtbd_entries(exerciseId);
      CREATE INDEX IF NOT EXISTS idx_entries_user ON jtbd_entries(userId);
      CREATE INDEX IF NOT EXISTS idx_votes_exercise ON vote_transactions(exerciseId);
      CREATE INDEX IF NOT EXISTS idx_votes_entry ON vote_transactions(entryId);
      CREATE INDEX IF NOT EXISTS idx_votes_user ON vote_transactions(userId);
    `)
    // Add mainPrompt column to existing tables (safe to fail if already present)
    try {
      await turso.execute('ALTER TABLE exercises ADD COLUMN mainPrompt TEXT')
    } catch {
      // Column already exists
    }

    console.log('[migrations] Turso migrations completed successfully')
  } catch (error) {
    console.error('[migrations] Migration error:', error)
    migrationRan = false
    throw error
  }
}
