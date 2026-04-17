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
      "ALTER TABLE qa_projects ADD COLUMN slug TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE qa_projects ADD COLUMN user_type_instructions TEXT NOT NULL DEFAULT '{}'",
    ]
    for (const sql of safeAlters) {
      try {
        await turso.execute(sql)
      } catch {
        // Column already exists
      }
    }

    // Backfill slugs for existing qa_projects rows that don't have one
    function toSlug(name: string): string {
      return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80)
    }
    const noSlug = await turso.execute("SELECT id, name FROM qa_projects WHERE slug = ''")
    for (const row of noSlug.rows) {
      const slug = toSlug(row.name as string) || (row.id as string).slice(-8)
      await turso.execute({ sql: "UPDATE qa_projects SET slug = ? WHERE id = ?", args: [slug, row.id] })
    }

    // QA Feature tables
    await turso.executeMultiple(`
      CREATE TABLE IF NOT EXISTS qa_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        platform TEXT NOT NULL DEFAULT 'Web',
        viewports TEXT NOT NULL DEFAULT '[]',
        operating_systems TEXT NOT NULL DEFAULT '[]',
        browsers TEXT NOT NULL DEFAULT '[]',
        user_types TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'draft',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS qa_test_items (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        tc_number TEXT NOT NULL DEFAULT '',
        part TEXT NOT NULL DEFAULT '',
        section TEXT NOT NULL DEFAULT '',
        feature_area TEXT NOT NULL DEFAULT '',
        platform TEXT NOT NULL DEFAULT '',
        user_type TEXT NOT NULL DEFAULT '',
        test_description TEXT NOT NULL DEFAULT '',
        steps TEXT NOT NULL DEFAULT '',
        expected_result TEXT NOT NULL DEFAULT '',
        jira_reference TEXT NOT NULL DEFAULT '',
        needs_review INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES qa_projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS qa_sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        tester_id TEXT NOT NULL,
        tester_name TEXT NOT NULL,
        tester_email TEXT NOT NULL,
        user_type TEXT NOT NULL,
        viewport TEXT NOT NULL,
        operating_system TEXT NOT NULL,
        browser TEXT NOT NULL,
        started_at TEXT NOT NULL,
        last_active_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES qa_projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS qa_results (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        test_item_id TEXT NOT NULL,
        tester_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'not_tested',
        steps_taken TEXT,
        expected_behavior TEXT,
        actual_behavior TEXT,
        blocked_note TEXT,
        test_username TEXT,
        screenshot_url TEXT,
        screenshot_filename TEXT,
        recorded_at TEXT,
        FOREIGN KEY (session_id) REFERENCES qa_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES qa_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (test_item_id) REFERENCES qa_test_items(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS qa_tester_usernames (
        id TEXT PRIMARY KEY,
        tester_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        username TEXT NOT NULL,
        used_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_qa_projects_status ON qa_projects(status);
      CREATE INDEX IF NOT EXISTS idx_qa_test_items_project ON qa_test_items(project_id);
      CREATE INDEX IF NOT EXISTS idx_qa_test_items_sort ON qa_test_items(project_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_qa_sessions_project ON qa_sessions(project_id);
      CREATE INDEX IF NOT EXISTS idx_qa_sessions_tester ON qa_sessions(tester_id);
      CREATE INDEX IF NOT EXISTS idx_qa_results_session ON qa_results(session_id);
      CREATE INDEX IF NOT EXISTS idx_qa_results_item ON qa_results(test_item_id);
      CREATE INDEX IF NOT EXISTS idx_qa_tester_usernames ON qa_tester_usernames(tester_id, project_id);
    `)

    console.log('[migrations] Turso migrations completed successfully')
  } catch (error) {
    console.error('[migrations] Migration error:', error)
    migrationRan = false
    throw error
  }
}
