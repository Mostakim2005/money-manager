import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { ElectronStateSnapshot, ElectronSyncLogEntry } from '../types';

function roundInt(val: unknown): number {
  return Math.round(Number(val || 0));
}

function resolveSchemaSql(explicitPath?: string): string {
  const candidates = [
    explicitPath,
    path.resolve(__dirname, 'schema/v1_core.sql'),
    path.resolve(process.cwd(), 'shared/schema/v1_core.sql'),
    path.resolve(__dirname, '../../shared/schema/v1_core.sql'),
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, 'utf-8');
    }
  }
  throw new Error(`Unable to locate canonical schema v1_core.sql. Checked: ${candidates.join(', ')}`);
}

export class MoneySqliteService {
  private db: Database.Database;
  private readonly dbPath: string;

  constructor(dbPath: string, schemaSqlPath?: string) {
    this.dbPath = dbPath;
    if (dbPath !== ':memory:') {
      mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    this.db = new Database(dbPath);
    // Enforce Trap 3 pragmas on every connection
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('foreign_keys = ON');

    const ddl = resolveSchemaSql(schemaSqlPath);
    this.db.exec(ddl);
  }

  public getDbInfo(): {
    dbPath: string;
    journalMode: string;
    synchronous: number;
    busyTimeout: number;
    foreignKeys: number;
    counts: Record<string, number>;
  } {
    const journalMode = String(this.db.pragma('journal_mode', { simple: true }) ?? 'unknown');
    const synchronous = Number(this.db.pragma('synchronous', { simple: true }) ?? 0);
    const busyTimeout = Number(this.db.pragma('busy_timeout', { simple: true }) ?? 0);
    const foreignKeys = Number(this.db.pragma('foreign_keys', { simple: true }) ?? 0);

    const countTable = (table: string): number => {
      const row = this.db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number } | undefined;
      return row?.c ?? 0;
    };

    return {
      dbPath: this.dbPath,
      journalMode,
      synchronous,
      busyTimeout,
      foreignKeys,
      counts: {
        accounts: countTable('accounts'),
        categories: countTable('categories'),
        transactions: countTable('transactions'),
        sanchaypatraSchemes: countTable('sanchaypatra_schemes'),
        fdrDpsAccounts: countTable('fdr_dps_accounts'),
        recurringSchedules: countTable('recurring_schedules'),
        rules: countTable('rules'),
        savingsGoals: countTable('savings_goals'),
        iouRecords: countTable('iou_records'),
        creditCardEmis: countTable('credit_card_emis'),
        syncLogs: countTable('sync_logs'),
      },
    };
  }

  public saveFullState(snapshot: ElectronStateSnapshot): void {
    const now = Date.now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      // Clear & replace entity tables atomically
      const tables = [
        'accounts',
        'categories',
        'transactions',
        'sanchaypatra_schemes',
        'fdr_dps_accounts',
        'recurring_schedules',
        'rules',
        'savings_goals',
        'iou_records',
        'credit_card_emis',
      ];
      for (const table of tables) {
        this.db.prepare(`DELETE FROM ${table}`).run();
      }

      const insertAccount = this.db.prepare(`
        INSERT INTO accounts (
          id, external_uid, name, type, balance, currency, account_number,
          credit_limit, billing_day, due_day, archived, color, icon, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const acc of snapshot.accounts || []) {
        insertAccount.run(
          String(acc.id),
          acc.externalUid ? String(acc.externalUid) : null,
          String(acc.name || 'Account'),
          String(acc.type || 'bank'),
          roundInt(acc.balance),
          String(acc.currency || 'BDT'),
          acc.accountNumber ? String(acc.accountNumber) : null,
          acc.creditLimit !== undefined && acc.creditLimit !== null ? roundInt(acc.creditLimit) : null,
          acc.billingDay !== undefined && acc.billingDay !== null ? Number(acc.billingDay) : null,
          acc.dueDay !== undefined && acc.dueDay !== null ? Number(acc.dueDay) : null,
          acc.archived ? 1 : 0,
          acc.color ? String(acc.color) : null,
          acc.icon ? String(acc.icon) : null,
          acc.updatedAt ? Number(acc.updatedAt) : null
        );
      }

      const insertCategory = this.db.prepare(`
        INSERT INTO categories (
          id, external_uid, name, parent_id, type, icon, color,
          subcategories_json, budget_monthly_allocated, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const cat of snapshot.categories || []) {
        insertCategory.run(
          String(cat.id),
          cat.externalUid ? String(cat.externalUid) : null,
          String(cat.name || 'Category'),
          cat.parentId ? String(cat.parentId) : null,
          cat.type === 'income' ? 'income' : 'expense',
          cat.icon ? String(cat.icon) : null,
          cat.color ? String(cat.color) : null,
          JSON.stringify(Array.isArray(cat.subcategories) ? cat.subcategories : []),
          roundInt(cat.budgetMonthlyAllocated),
          cat.updatedAt ? Number(cat.updatedAt) : null
        );
      }

      const insertTxn = this.db.prepare(`
        INSERT INTO transactions (
          id, external_uid, fingerprint, sync_source, date, time, amount, type,
          category_id, subcategory_id, account_id, target_account_id, note,
          description, currency, original_amount, exchange_rate, receipt_path,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const txn of snapshot.transactions || []) {
        insertTxn.run(
          String(txn.id),
          txn.externalUid ? String(txn.externalUid) : null,
          txn.fingerprint ? String(txn.fingerprint) : null,
          String(txn.syncSource || 'local'),
          String(txn.date),
          txn.time ? String(txn.time) : null,
          roundInt(txn.amount),
          String(txn.type || 'expense'),
          String(txn.categoryId || ''),
          txn.subcategoryId ? String(txn.subcategoryId) : null,
          String(txn.accountId || ''),
          txn.targetAccountId ? String(txn.targetAccountId) : null,
          txn.note ? String(txn.note) : null,
          txn.description ? String(txn.description) : null,
          String(txn.currency || 'BDT'),
          txn.originalAmount !== undefined && txn.originalAmount !== null ? Number(txn.originalAmount) : null,
          txn.exchangeRate !== undefined && txn.exchangeRate !== null ? Number(txn.exchangeRate) : null,
          txn.receiptPath ? String(txn.receiptPath) : null,
          Number(txn.createdAt || now),
          Number(txn.updatedAt || now)
        );
      }

      const insertSp = this.db.prepare(`
        INSERT INTO sanchaypatra_schemes (
          id, scheme_def_id, name, registration_no, principal, issue_date,
          maturity_date, tenure_years, payout_frequency_months, slab_gross_rate,
          ait_rate, net_periodic_profit, linked_account_id, next_payout_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const sp of snapshot.sanchaypatraSchemes || []) {
        insertSp.run(
          String(sp.id),
          sp.schemeDefId ? String(sp.schemeDefId) : null,
          String(sp.name),
          String(sp.registrationNo),
          roundInt(sp.principal),
          String(sp.issueDate),
          String(sp.maturityDate),
          Number(sp.tenureYears || 5),
          Number(sp.payoutFrequencyMonths || 6),
          Number(sp.slabGrossRate || 0),
          Number(sp.aitRate || 0.1),
          roundInt(sp.netPeriodicProfit),
          String(sp.linkedAccountId || ''),
          String(sp.nextPayoutDate || sp.issueDate),
          String(sp.status || 'active')
        );
      }

      const insertFdr = this.db.prepare(`
        INSERT INTO fdr_dps_accounts (
          id, kind, bank_name, account_number, principal, monthly_installment,
          annual_rate, ait_rate, tenure_months, paid_installments, start_date,
          maturity_date, expected_maturity_amount, linked_account_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of snapshot.fdrDpsAccounts || []) {
        insertFdr.run(
          String(item.id),
          item.kind === 'dps' ? 'dps' : 'fdr',
          String(item.bankName || ''),
          String(item.accountNumber || ''),
          roundInt(item.principal),
          roundInt(item.monthlyInstallment),
          Number(item.annualRate || 0),
          Number(item.aitRate ?? 0.1),
          Number(item.tenureMonths || 12),
          Number(item.paidInstallments || 0),
          String(item.startDate || ''),
          String(item.maturityDate || ''),
          roundInt(item.expectedMaturityAmount),
          String(item.linkedAccountId || ''),
          String(item.status || 'active')
        );
      }

      const insertRec = this.db.prepare(`
        INSERT INTO recurring_schedules (
          id, name, amount, type, category_id, account_id,
          target_account_id, frequency, next_due_date, auto_post, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const sched of snapshot.recurringSchedules || []) {
        insertRec.run(
          String(sched.id),
          String(sched.name || ''),
          roundInt(sched.amount),
          String(sched.type || 'expense'),
          String(sched.categoryId || ''),
          String(sched.accountId || ''),
          sched.targetAccountId ? String(sched.targetAccountId) : null,
          String(sched.frequency || 'monthly'),
          String(sched.nextDueDate || ''),
          sched.autoPost ? 1 : 0,
          sched.note ? String(sched.note) : null
        );
      }

      const insertRule = this.db.prepare(`
        INSERT INTO rules (id, name, enabled, match_mode, conditions_json, actions_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const rule of snapshot.rules || []) {
        insertRule.run(
          String(rule.id),
          String(rule.name || ''),
          rule.enabled ? 1 : 0,
          String(rule.matchMode || 'ANY'),
          JSON.stringify(rule.conditions || []),
          JSON.stringify(rule.actions || [])
        );
      }

      const insertGoal = this.db.prepare(`
        INSERT INTO savings_goals (
          id, name, target_amount, current_amount, target_date,
          linked_account_id, color, note, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const goal of snapshot.savingsGoals || []) {
        insertGoal.run(
          String(goal.id),
          String(goal.name || ''),
          roundInt(goal.targetAmount),
          roundInt(goal.currentAmount),
          String(goal.targetDate || ''),
          String(goal.linkedAccountId || ''),
          goal.color ? String(goal.color) : null,
          goal.note ? String(goal.note) : null,
          String(goal.status || 'active'),
          Number(goal.createdAt || now),
          Number(goal.updatedAt || now)
        );
      }

      const insertIou = this.db.prepare(`
        INSERT INTO iou_records (
          id, person_name, direction, principal, paid_amount, date,
          due_date, account_id, note, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const iou of snapshot.iouRecords || []) {
        insertIou.run(
          String(iou.id),
          String(iou.personName || ''),
          iou.direction === 'borrowed' ? 'borrowed' : 'lent',
          roundInt(iou.principal),
          roundInt(iou.paidAmount),
          String(iou.date || ''),
          iou.dueDate ? String(iou.dueDate) : null,
          String(iou.accountId || ''),
          iou.note ? String(iou.note) : null,
          String(iou.status || 'open'),
          Number(iou.createdAt || now),
          Number(iou.updatedAt || now)
        );
      }

      const insertEmi = this.db.prepare(`
        INSERT INTO credit_card_emis (
          id, account_id, title, total_amount, tenure_months,
          paid_months, monthly_installment, start_date, next_due_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const emi of snapshot.creditCardEmis || []) {
        insertEmi.run(
          String(emi.id),
          String(emi.accountId || ''),
          String(emi.title || ''),
          roundInt(emi.totalAmount),
          Number(emi.tenureMonths || 1),
          Number(emi.paidMonths || 0),
          roundInt(emi.monthlyInstallment),
          String(emi.startDate || ''),
          String(emi.nextDueDate || ''),
          String(emi.status || 'active')
        );
      }

      const upsertSetting = this.db.prepare(`
        INSERT INTO app_settings (key, value_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
      `);
      upsertSetting.run('preferences', JSON.stringify(snapshot.preferences), now);
      upsertSetting.run('initialized', JSON.stringify(true), now);

      if (Array.isArray(snapshot.syncLogs) && snapshot.syncLogs.length > 0) {
        const insertLog = this.db.prepare(`
          INSERT OR REPLACE INTO sync_logs (
            id, source, timestamp, inserted_count, updated_count, skipped_count,
            deleted_count, merged_accounts, merged_categories, wal_verified,
            scope_label, status, error_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const log of snapshot.syncLogs.slice(0, 100)) {
          insertLog.run(
            String(log.id),
            String(log.source),
            Number(log.timestamp),
            Number(log.insertedCount || 0),
            Number(log.updatedCount || 0),
            Number(log.skippedCount || 0),
            Number(log.deletedCount || 0),
            Number(log.mergedAccounts || 0),
            Number(log.mergedCategories || 0),
            log.walVerified ? 1 : 0,
            log.scopeLabel ? String(log.scopeLabel) : null,
            String(log.status || 'success'),
            log.errorMessage ? String(log.errorMessage) : null
          );
        }
      }

      this.db.exec('COMMIT');
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Ignore rollback failure if no active txn
      }
      throw err;
    }
  }

  public loadFullState(): ElectronStateSnapshot | null {
    const initRow = this.db
      .prepare(`SELECT value_json FROM app_settings WHERE key = 'initialized'`)
      .get() as { value_json: string } | undefined;
    if (!initRow) return null;

    const prefRow = this.db
      .prepare(`SELECT value_json FROM app_settings WHERE key = 'preferences'`)
      .get() as { value_json: string } | undefined;

    const preferences = prefRow ? JSON.parse(prefRow.value_json) : {};

    const accounts = (this.db.prepare('SELECT * FROM accounts').all() as any[]).map((r) => ({
      id: r.id,
      externalUid: r.external_uid || undefined,
      name: r.name,
      type: r.type,
      balance: roundInt(r.balance),
      currency: r.currency,
      accountNumber: r.account_number || undefined,
      creditLimit: r.credit_limit !== null ? roundInt(r.credit_limit) : undefined,
      billingDay: r.billing_day ?? undefined,
      dueDay: r.due_day ?? undefined,
      archived: Boolean(r.archived),
      color: r.color || undefined,
      icon: r.icon || undefined,
      updatedAt: r.updated_at ?? undefined,
    }));

    const categories = (this.db.prepare('SELECT * FROM categories').all() as any[]).map((r) => ({
      id: r.id,
      externalUid: r.external_uid || undefined,
      name: r.name,
      parentId: r.parent_id || undefined,
      type: r.type,
      icon: r.icon || undefined,
      color: r.color || undefined,
      subcategories: r.subcategories_json ? JSON.parse(r.subcategories_json) : [],
      budgetMonthlyAllocated: roundInt(r.budget_monthly_allocated),
      updatedAt: r.updated_at ?? undefined,
    }));

    const transactions = (
      this.db.prepare('SELECT * FROM transactions ORDER BY date DESC, created_at DESC').all() as any[]
    ).map((r) => ({
      id: r.id,
      externalUid: r.external_uid || undefined,
      fingerprint: r.fingerprint || undefined,
      syncSource: r.sync_source || 'local',
      date: r.date,
      time: r.time || undefined,
      amount: roundInt(r.amount),
      type: r.type,
      categoryId: r.category_id,
      subcategoryId: r.subcategory_id || undefined,
      accountId: r.account_id,
      targetAccountId: r.target_account_id || undefined,
      note: r.note || undefined,
      description: r.description || undefined,
      currency: r.currency || undefined,
      originalAmount: r.original_amount ?? undefined,
      exchangeRate: r.exchange_rate ?? undefined,
      receiptPath: r.receipt_path || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    const sanchaypatraSchemes = (this.db.prepare('SELECT * FROM sanchaypatra_schemes').all() as any[]).map((r) => ({
      id: r.id,
      schemeDefId: r.scheme_def_id || undefined,
      name: r.name,
      registrationNo: r.registration_no,
      principal: roundInt(r.principal),
      issueDate: r.issue_date,
      maturityDate: r.maturity_date,
      tenureYears: r.tenure_years,
      payoutFrequencyMonths: r.payout_frequency_months,
      slabGrossRate: r.slab_gross_rate,
      aitRate: r.ait_rate,
      netPeriodicProfit: roundInt(r.net_periodic_profit),
      linkedAccountId: r.linked_account_id,
      nextPayoutDate: r.next_payout_date,
      status: r.status || 'active',
    }));

    const fdrDpsAccounts = (this.db.prepare('SELECT * FROM fdr_dps_accounts').all() as any[]).map((r) => ({
      id: r.id,
      kind: r.kind,
      bankName: r.bank_name,
      accountNumber: r.account_number,
      principal: roundInt(r.principal),
      monthlyInstallment: roundInt(r.monthly_installment),
      annualRate: r.annual_rate,
      aitRate: r.ait_rate,
      tenureMonths: r.tenure_months,
      paidInstallments: r.paid_installments,
      startDate: r.start_date,
      maturityDate: r.maturity_date,
      expectedMaturityAmount: roundInt(r.expected_maturity_amount),
      linkedAccountId: r.linked_account_id,
      status: r.status || 'active',
    }));

    const recurringSchedules = (this.db.prepare('SELECT * FROM recurring_schedules').all() as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      amount: roundInt(r.amount),
      type: r.type,
      categoryId: r.category_id,
      accountId: r.account_id,
      targetAccountId: r.target_account_id || undefined,
      frequency: r.frequency,
      nextDueDate: r.next_due_date,
      autoPost: Boolean(r.auto_post),
      note: r.note || undefined,
    }));

    const rules = (this.db.prepare('SELECT * FROM rules').all() as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      enabled: Boolean(r.enabled),
      matchMode: r.match_mode || 'ANY',
      conditions: JSON.parse(r.conditions_json || '[]'),
      actions: JSON.parse(r.actions_json || '[]'),
    }));

    const savingsGoals = (this.db.prepare('SELECT * FROM savings_goals').all() as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      targetAmount: roundInt(r.target_amount),
      currentAmount: roundInt(r.current_amount),
      targetDate: r.target_date,
      linkedAccountId: r.linked_account_id,
      color: r.color || undefined,
      note: r.note || undefined,
      status: r.status || 'active',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    const iouRecords = (this.db.prepare('SELECT * FROM iou_records').all() as any[]).map((r) => ({
      id: r.id,
      personName: r.person_name,
      direction: r.direction,
      principal: roundInt(r.principal),
      paidAmount: roundInt(r.paid_amount),
      date: r.date,
      dueDate: r.due_date || undefined,
      accountId: r.account_id,
      note: r.note || undefined,
      status: r.status || 'open',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    const creditCardEmis = (this.db.prepare('SELECT * FROM credit_card_emis').all() as any[]).map((r) => ({
      id: r.id,
      accountId: r.account_id,
      title: r.title,
      totalAmount: roundInt(r.total_amount),
      tenureMonths: r.tenure_months,
      paidMonths: r.paid_months,
      monthlyInstallment: roundInt(r.monthly_installment),
      startDate: r.start_date,
      nextDueDate: r.next_due_date,
      status: r.status || 'active',
    }));

    const syncLogs = this.getSyncLogs(100);

    return {
      preferences,
      accounts,
      categories,
      transactions,
      sanchaypatraSchemes,
      fdrDpsAccounts,
      recurringSchedules,
      rules,
      savingsGoals,
      iouRecords,
      creditCardEmis,
      syncLogs,
    };
  }

  public appendSyncLog(entry: ElectronSyncLogEntry): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          `
        INSERT OR REPLACE INTO sync_logs (
          id, source, timestamp, inserted_count, updated_count, skipped_count,
          deleted_count, merged_accounts, merged_categories, wal_verified,
          scope_label, status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          String(entry.id),
          String(entry.source),
          Number(entry.timestamp),
          Number(entry.insertedCount || 0),
          Number(entry.updatedCount || 0),
          Number(entry.skippedCount || 0),
          Number(entry.deletedCount || 0),
          Number(entry.mergedAccounts || 0),
          Number(entry.mergedCategories || 0),
          entry.walVerified ? 1 : 0,
          entry.scopeLabel ? String(entry.scopeLabel) : null,
          String(entry.status || 'success'),
          entry.errorMessage ? String(entry.errorMessage) : null
        );
      this.db.exec('COMMIT');
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Ignore rollback failure
      }
      throw err;
    }
  }

  public getSyncLogs(limit: number = 50): ElectronSyncLogEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM sync_logs ORDER BY timestamp DESC LIMIT ?')
      .all(Math.max(1, Math.min(500, Math.round(limit)))) as any[];

    return rows.map((r) => ({
      id: r.id,
      source: r.source,
      timestamp: r.timestamp,
      insertedCount: r.inserted_count,
      updatedCount: r.updated_count,
      skippedCount: r.skipped_count,
      deletedCount: r.deleted_count,
      mergedAccounts: r.merged_accounts,
      mergedCategories: r.merged_categories,
      walVerified: Boolean(r.wal_verified),
      scopeLabel: r.scope_label || undefined,
      status: r.status || 'success',
      errorMessage: r.error_message || undefined,
    }));
  }

  public close(): void {
    if (this.db.open) {
      this.db.close();
    }
  }
}
