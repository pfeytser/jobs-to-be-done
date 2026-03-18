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
        type TEXT NOT NULL DEFAULT 'jtbd',
        sentimentAnalysis TEXT,
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

      CREATE TABLE IF NOT EXISTS sentiment_entries (
        id TEXT PRIMARY KEY,
        exerciseId TEXT NOT NULL,
        userId TEXT NOT NULL,
        userEmail TEXT NOT NULL,
        userName TEXT,
        term TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (exerciseId) REFERENCES exercises(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_entries_exercise ON jtbd_entries(exerciseId);
      CREATE INDEX IF NOT EXISTS idx_entries_user ON jtbd_entries(userId);
      CREATE INDEX IF NOT EXISTS idx_votes_exercise ON vote_transactions(exerciseId);
      CREATE INDEX IF NOT EXISTS idx_votes_entry ON vote_transactions(entryId);
      CREATE INDEX IF NOT EXISTS idx_votes_user ON vote_transactions(userId);
      CREATE INDEX IF NOT EXISTS idx_sentiment_exercise ON sentiment_entries(exerciseId);
      CREATE INDEX IF NOT EXISTS idx_sentiment_user ON sentiment_entries(userId);

      CREATE TABLE IF NOT EXISTS brainstorm_problem_statements (
        id TEXT PRIMARY KEY,
        exerciseId TEXT NOT NULL,
        entryId TEXT NOT NULL,
        problemStatement TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (exerciseId) REFERENCES exercises(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS brainstorm_solutions (
        id TEXT PRIMARY KEY,
        exerciseId TEXT NOT NULL,
        entryId TEXT NOT NULL,
        userId TEXT NOT NULL,
        userName TEXT,
        text TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (exerciseId) REFERENCES exercises(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_bps_exercise ON brainstorm_problem_statements(exerciseId);
      CREATE INDEX IF NOT EXISTS idx_bps_entry ON brainstorm_problem_statements(entryId);
      CREATE INDEX IF NOT EXISTS idx_bs_exercise ON brainstorm_solutions(exerciseId);
      CREATE INDEX IF NOT EXISTS idx_bs_entry ON brainstorm_solutions(entryId);

      CREATE TABLE IF NOT EXISTS sentiment_cluster_solutions (
        id TEXT PRIMARY KEY,
        exerciseId TEXT NOT NULL,
        clusterLabel TEXT NOT NULL,
        userId TEXT NOT NULL,
        userName TEXT,
        text TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (exerciseId) REFERENCES exercises(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_scs_exercise ON sentiment_cluster_solutions(exerciseId);
      CREATE INDEX IF NOT EXISTS idx_scs_cluster ON sentiment_cluster_solutions(exerciseId, clusterLabel);
    `)

    // Add columns to existing tables (safe to fail if already present)
    const safeAlters = [
      'ALTER TABLE exercises ADD COLUMN mainPrompt TEXT',
      "ALTER TABLE exercises ADD COLUMN type TEXT NOT NULL DEFAULT 'jtbd'",
      'ALTER TABLE exercises ADD COLUMN sentimentAnalysis TEXT',
      'ALTER TABLE exercises ADD COLUMN isArchived INTEGER NOT NULL DEFAULT 0',
      "ALTER TABLE exercises ADD COLUMN jtbdMode TEXT NOT NULL DEFAULT 'classic'",
      'ALTER TABLE exercises ADD COLUMN jtbdDeduplication TEXT',
      'ALTER TABLE exercises ADD COLUMN jtbdDiscussionAnalysis TEXT',
      'ALTER TABLE exercises ADD COLUMN jtbdSynthesis TEXT',
    ]
    for (const sql of safeAlters) {
      try {
        await turso.execute(sql)
      } catch {
        // Column already exists
      }
    }

    console.log('[migrations] Turso migrations completed successfully')
  } catch (error) {
    console.error('[migrations] Migration error:', error)
    migrationRan = false
    throw error
  }
}
