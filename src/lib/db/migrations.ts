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
      "ALTER TABLE qa_sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'in_progress'",
      "ALTER TABLE qa_test_items ADD COLUMN viewport TEXT NOT NULL DEFAULT ''",
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

    // On-site & Storyboard feature tables
    await turso.executeMultiple(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id TEXT PRIMARY KEY,
        sea_creature TEXT,
        sea_creature_why TEXT,
        sea_creature_avatar TEXT,
        sea_creature_skipped INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS storyboard_use_cases (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS storyboards (
        id TEXT PRIMARY KEY,
        use_case_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        customer_name TEXT NOT NULL DEFAULT '',
        customer_demographics TEXT NOT NULL DEFAULT '',
        company_type TEXT NOT NULL DEFAULT '',
        customer_role TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (use_case_id) REFERENCES storyboard_use_cases(id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_storyboards_unique ON storyboards(use_case_id, user_id);

      CREATE TABLE IF NOT EXISTS storyboard_cards (
        id TEXT PRIMARY KEY,
        storyboard_id TEXT NOT NULL,
        scene_description TEXT NOT NULL DEFAULT '',
        image_url TEXT,
        generation_requested_at TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (storyboard_id) REFERENCES storyboards(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_storyboard_use_cases_status ON storyboard_use_cases(status);
      CREATE INDEX IF NOT EXISTS idx_storyboards_use_case ON storyboards(use_case_id);
      CREATE INDEX IF NOT EXISTS idx_storyboards_user ON storyboards(user_id);
      CREATE INDEX IF NOT EXISTS idx_storyboard_cards_board ON storyboard_cards(storyboard_id);
      CREATE INDEX IF NOT EXISTS idx_storyboard_cards_sort ON storyboard_cards(storyboard_id, sort_order);
    `)

    // Users registry + Two Truths & A Lie feature tables
    await turso.executeMultiple(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT,
        image TEXT,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at);

      CREATE TABLE IF NOT EXISTS tt_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL DEFAULT '',
        author_email TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        activated_at TEXT,
        revealed_at TEXT,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS tt_statements (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        text TEXT NOT NULL DEFAULT '',
        is_lie INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES tt_sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tt_votes (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        statement_id TEXT NOT NULL,
        voter_id TEXT NOT NULL,
        voter_name TEXT NOT NULL DEFAULT '',
        voter_email TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES tt_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (statement_id) REFERENCES tt_statements(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_tt_sessions_status ON tt_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_tt_sessions_author ON tt_sessions(author_id);
      CREATE INDEX IF NOT EXISTS idx_tt_statements_session ON tt_statements(session_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tt_votes_unique ON tt_votes(session_id, voter_id);
      CREATE INDEX IF NOT EXISTS idx_tt_votes_session ON tt_votes(session_id);
    `)

    // Expense Reports feature — Coupa expense transaction imports
    await turso.executeMultiple(`
      CREATE TABLE IF NOT EXISTS expense_transactions (
        id TEXT PRIMARY KEY,
        report_number TEXT NOT NULL DEFAULT '',
        report_name TEXT NOT NULL DEFAULT '',
        statement_date TEXT,
        card_id TEXT NOT NULL DEFAULT '',
        expensed_by TEXT NOT NULL DEFAULT '',
        expense_date TEXT,
        category TEXT NOT NULL DEFAULT '',
        item_name TEXT NOT NULL DEFAULT '',
        merchant TEXT NOT NULL DEFAULT '',
        amount_usd REAL,
        receipt_amount_original REAL,
        gl_code TEXT NOT NULL DEFAULT '',
        account_full TEXT NOT NULL DEFAULT '',
        reimburse_to_employee TEXT NOT NULL DEFAULT '',
        reason TEXT NOT NULL DEFAULT '',
        bill_back TEXT NOT NULL DEFAULT '',
        billed_back_to TEXT NOT NULL DEFAULT '',
        price_per_unit REAL,
        arrival_date TEXT,
        report_total_usd REAL,
        report_reimburse_total_usd REAL,
        source_file_name TEXT NOT NULL DEFAULT '',
        source_row_hash TEXT NOT NULL,
        raw_row_json TEXT NOT NULL DEFAULT '{}',
        match_status TEXT NOT NULL DEFAULT 'unmatched',
        matched_receipt_file_id TEXT,
        confidence_score REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_tx_hash ON expense_transactions(source_row_hash);
      CREATE INDEX IF NOT EXISTS idx_expense_tx_expense_date ON expense_transactions(expense_date);
      CREATE INDEX IF NOT EXISTS idx_expense_tx_statement_date ON expense_transactions(statement_date);
      CREATE INDEX IF NOT EXISTS idx_expense_tx_match_status ON expense_transactions(match_status);
      CREATE INDEX IF NOT EXISTS idx_expense_tx_merchant ON expense_transactions(merchant);
      CREATE INDEX IF NOT EXISTS idx_expense_tx_report ON expense_transactions(report_number);
      CREATE INDEX IF NOT EXISTS idx_expense_tx_source_file ON expense_transactions(source_file_name);
    `)

    // Expense Reports Phase 2 — Gmail receipt matching
    await turso.executeMultiple(`
      CREATE TABLE IF NOT EXISTS connected_email_accounts (
        id TEXT PRIMARY KEY,
        account_label TEXT NOT NULL DEFAULT '',
        email_address TEXT NOT NULL DEFAULT '',
        provider TEXT NOT NULL DEFAULT 'gmail',
        oauth_token_reference TEXT,
        token_scope TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        last_authorized_at TEXT,
        last_synced_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cea_email ON connected_email_accounts(email_address);
      CREATE INDEX IF NOT EXISTS idx_cea_active ON connected_email_accounts(is_active);

      CREATE TABLE IF NOT EXISTS receipt_files (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL DEFAULT 'manual_upload',
        storage_provider TEXT NOT NULL DEFAULT 'vercel_blob',
        storage_url TEXT,
        storage_file_id TEXT,
        file_name TEXT NOT NULL DEFAULT '',
        mime_type TEXT NOT NULL DEFAULT '',
        sha256_hash TEXT NOT NULL,
        email_account_id TEXT,
        gmail_message_id TEXT,
        gmail_thread_id TEXT,
        gmail_subject TEXT,
        gmail_from TEXT,
        gmail_to TEXT,
        gmail_date TEXT,
        original_source_url TEXT,
        extracted_text TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (email_account_id) REFERENCES connected_email_accounts(id) ON DELETE SET NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_files_sha ON receipt_files(sha256_hash);
      CREATE INDEX IF NOT EXISTS idx_receipt_files_msg ON receipt_files(email_account_id, gmail_message_id);

      CREATE TABLE IF NOT EXISTS receipt_matches (
        id TEXT PRIMARY KEY,
        expense_transaction_id TEXT NOT NULL,
        receipt_file_id TEXT,
        confidence_score REAL NOT NULL DEFAULT 0,
        match_method TEXT NOT NULL DEFAULT '',
        match_status TEXT NOT NULL DEFAULT 'candidate',
        matched_amount_type TEXT NOT NULL DEFAULT 'unknown',
        matched_amount_value REAL,
        matched_email_account_id TEXT,
        reason_summary TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (expense_transaction_id) REFERENCES expense_transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (receipt_file_id) REFERENCES receipt_files(id) ON DELETE SET NULL,
        FOREIGN KEY (matched_email_account_id) REFERENCES connected_email_accounts(id) ON DELETE SET NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_matches_unique ON receipt_matches(expense_transaction_id, receipt_file_id);
      CREATE INDEX IF NOT EXISTS idx_receipt_matches_expense ON receipt_matches(expense_transaction_id);
      CREATE INDEX IF NOT EXISTS idx_receipt_matches_status ON receipt_matches(match_status);
    `)

    // Phase 2 column on expense_transactions — throttle re-search
    try {
      await turso.execute('ALTER TABLE expense_transactions ADD COLUMN last_searched_at TEXT')
    } catch {
      // Column already exists
    }

    // Expense Reports — Flights tracker (airline emails grouped into trips)
    await turso.executeMultiple(`
      CREATE TABLE IF NOT EXISTS flight_emails (
        id TEXT PRIMARY KEY,
        email_account_id TEXT NOT NULL,
        gmail_message_id TEXT NOT NULL,
        gmail_thread_id TEXT,
        airline TEXT NOT NULL DEFAULT '',
        confirmation_code TEXT,
        travel_date TEXT,
        route TEXT,
        amount REAL,
        currency TEXT,
        gmail_subject TEXT,
        gmail_from TEXT,
        gmail_date TEXT,
        trip_key TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (email_account_id) REFERENCES connected_email_accounts(id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_flight_emails_msg ON flight_emails(email_account_id, gmail_message_id);
      CREATE INDEX IF NOT EXISTS idx_flight_emails_trip ON flight_emails(trip_key);

      CREATE TABLE IF NOT EXISTS flight_trips (
        id TEXT PRIMARY KEY,
        trip_key TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        start_date TEXT,
        end_date TEXT,
        airlines TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'uncategorized',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_flight_trips_key ON flight_trips(trip_key);
      CREATE INDEX IF NOT EXISTS idx_flight_trips_category ON flight_trips(category);

      -- Translation Review & Editing tool --------------------------------------
      CREATE TABLE IF NOT EXISTS translation_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- One loaded body of copy. Kind is 'ui' (JSON dictionaries) or 'csv' (DB export).
      -- english_source holds the ORIGINAL source artifact verbatim: the en.json text
      -- for UI datasets, or the full CSV text for DB datasets. config_json holds the
      -- per-language target files (UI) or the column mapping (CSV). Exports are always
      -- rebuilt from these originals, so structure can never drift (see brief §8).
      CREATE TABLE IF NOT EXISTS translation_datasets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        english_source TEXT NOT NULL,
        config_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES translation_projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_translation_datasets_project ON translation_datasets(project_id);

      -- An edit is a single target-language string value, stored as a diff against the
      -- originally loaded value. entry_key is the JSON key-path (UI) or row index (CSV).
      CREATE TABLE IF NOT EXISTS translation_edits (
        id TEXT PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        lang TEXT NOT NULL,
        entry_key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_by TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (dataset_id) REFERENCES translation_datasets(id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_edits_unique
        ON translation_edits(dataset_id, lang, entry_key);
    `)

    // RFC822 Message-ID for reliable Gmail deep links (added after initial release)
    try {
      await turso.execute('ALTER TABLE flight_emails ADD COLUMN rfc822_message_id TEXT')
    } catch {
      // Column already exists
    }

    // Rename storyboard status 'edit' → 'create' (must run after storyboard tables are created)
    try {
      await turso.execute("UPDATE storyboard_use_cases SET status = 'create' WHERE status = 'edit'")
    } catch {
      // Table may not exist on first run — safe to ignore
    }

    // Add acknowledged columns to qa_results
    try {
      await turso.execute('ALTER TABLE qa_results ADD COLUMN acknowledged_at TEXT')
    } catch {
      // Column already exists
    }
    try {
      await turso.execute('ALTER TABLE qa_results ADD COLUMN acknowledged_by TEXT')
    } catch {
      // Column already exists
    }

    // Seed the two default translation projects. Fixed ids + INSERT OR IGNORE means a
    // rename sticks and re-runs never duplicate; only ever inserted when absent.
    {
      const now = new Date().toISOString()
      await turso.batch(
        [
          { sql: 'INSERT OR IGNORE INTO translation_projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', args: ['web', 'Web', now, now] },
          { sql: 'INSERT OR IGNORE INTO translation_projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', args: ['mobile', 'Mobile app', now, now] },
        ],
        'write',
      )
    }

    console.log('[migrations] Turso migrations completed successfully')
  } catch (error) {
    console.error('[migrations] Migration error:', error)
    migrationRan = false
    throw error
  }
}
