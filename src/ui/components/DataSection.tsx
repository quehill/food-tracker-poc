import { useEffect, useRef, useState } from 'react';
import { repos } from '../../app/repos';
import { backupFilename, createBackupFile, parseBackup, serializeBackup } from '../../data/backup';
import { csvFilename, logEntriesToCsv } from '../../data/csv';
import { saveFile } from '../fileSave';
import { plural } from '../format';
import { useRepoQuery } from '../hooks/useRepoQuery';
import {
  getPersistState,
  isInstalledApp,
  requestPersistentStorage,
  type PersistState,
} from '../storage';

const DAY_MS = 24 * 60 * 60 * 1000;
const BACKUP_REMINDER_DAYS = 7;

function BackupReminder({ lastBackupAt, hasData }: { lastBackupAt?: number; hasData: boolean }) {
  if (lastBackupAt === undefined) {
    return hasData ? (
      <p className="notice">
        You haven&apos;t exported a backup yet. Browsers (especially iOS Safari) can clear website
        data, so export one now.
      </p>
    ) : (
      <p className="small muted">No backups yet.</p>
    );
  }
  const days = Math.floor((Date.now() - lastBackupAt) / DAY_MS);
  const when = new Date(lastBackupAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return days >= BACKUP_REMINDER_DAYS ? (
    <p className="notice">
      Last backup was {days} days ago ({when}). Consider exporting a new one.
    </p>
  ) : (
    <p className="small muted">Last backup: {when}</p>
  );
}

const PERSIST_TEXT: Record<PersistState, string> = {
  granted: 'Persistent storage: on. The browser should not clear your data automatically.',
  'not-granted':
    'Persistent storage: not granted. The browser may clear data if the app goes unused; keep backups.',
  unsupported: 'Persistent storage: not supported by this browser. Keep backups.',
};

export function DataSection() {
  const backupInfo = useRepoQuery(async () => ({ at: await repos.settings.getLastBackupAt() }), []);
  const counts = useRepoQuery(async () => {
    const d = await repos.backup.exportData();
    return { foods: d.foods.length, meals: d.meals.length, entries: d.logEntries.length };
  }, []);
  const [persist, setPersist] = useState<PersistState | null>(null);
  const [status, setStatus] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const installed = isInstalledApp();

  useEffect(() => {
    void getPersistState().then(setPersist);
  }, []);

  const hasData = !!counts && counts.foods + counts.meals + counts.entries > 0;

  const exportJson = async () => {
    const now = new Date();
    const file = createBackupFile(await repos.backup.exportData(), now);
    const result = await saveFile(backupFilename(now), serializeBackup(file), 'application/json');
    if (result === 'cancelled') return setStatus('Export cancelled.');
    await repos.settings.setLastBackupAt(now.getTime());
    setStatus('Backup exported.');
  };

  const exportCsv = async () => {
    const entries = await repos.log.listAll();
    const result = await saveFile(csvFilename(new Date()), logEntriesToCsv(entries), 'text/csv');
    setStatus(
      result === 'cancelled'
        ? 'Export cancelled.'
        : `Exported ${plural(entries.length, 'log entry', 'log entries')}.`,
    );
  };

  const importJson = async (file: File) => {
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) return setStatus(`Import failed: ${parsed.error}`);
    const { foods, meals, logEntries } = parsed.data;
    const from = parsed.exportedAt ? ` from ${new Date(parsed.exportedAt).toLocaleString()}` : '';
    const ok = window.confirm(
      `Restore the backup${from}? It has ${plural(foods.length, 'food')}, ${plural(meals.length, 'meal')} and ${plural(logEntries.length, 'log entry', 'log entries')}.\n\nAll current data on this device will be replaced.`,
    );
    if (!ok) return setStatus('Import cancelled.');
    await repos.backup.replaceAll(parsed.data);
    setStatus('Backup restored.');
  };

  const clearAll = async () => {
    const ok = window.confirm(
      'Delete all foods, meals, log entries and targets on this device?\n\nThis cannot be undone. Export a backup first if you might need them.',
    );
    if (!ok) return;
    await repos.backup.clearAll();
    setStatus('All data cleared.');
  };

  return (
    <section className="card stack" aria-labelledby="data-heading">
      <h2 id="data-heading">Data</h2>
      <p className="small muted">
        Your data is stored only on this device.
        {counts &&
          ` ${plural(counts.foods, 'food')}, ${plural(counts.meals, 'meal')}, ${plural(counts.entries, 'log entry', 'log entries')}.`}
      </p>

      {backupInfo && <BackupReminder lastBackupAt={backupInfo.at} hasData={hasData} />}

      <button type="button" className="button primary block" onClick={() => void exportJson()}>
        Export JSON backup
      </button>
      <button type="button" className="button block" onClick={() => fileInput.current?.click()}>
        Import JSON backup
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void importJson(file);
        }}
      />
      <button type="button" className="button block" onClick={() => void exportCsv()}>
        Export log as CSV
      </button>

      <p className="small" role="status" aria-live="polite">
        {status}
      </p>

      {persist && <p className="small muted">{PERSIST_TEXT[persist]}</p>}
      {persist === 'not-granted' && (
        <button
          type="button"
          className="button block"
          onClick={() => void requestPersistentStorage().then(setPersist)}
        >
          Request persistent storage
        </button>
      )}
      {!installed && (
        <p className="small muted">
          Tip: install the app for more reliable storage. On iPhone, open this page in Safari, tap
          Share, then Add to Home Screen. The installed app and the Safari tab keep separate data,
          so move it with a backup.
        </p>
      )}

      <button type="button" className="button danger block" onClick={() => void clearAll()}>
        Clear all data
      </button>
    </section>
  );
}
