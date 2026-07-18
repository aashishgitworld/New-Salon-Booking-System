'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { NotificationLog, PaginatedData } from '@/lib/types';

export default function LogsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: PaginatedData<NotificationLog> }>(
        '/notifications/logs',
        {
          params: {
            page,
            limit: 20,
            ...(statusFilter ? { status: statusFilter } : {}),
          },
        },
      );
      setLogs(res.data.data.data);
      setMeta({
        total: res.data.data.meta.total,
        totalPages: res.data.data.meta.totalPages,
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Real-time: refresh on any notification event
  useEffect(() => {
    const socket = getSocket('notifications');

    const handleEvent = () => {
      // Debounced via flag
      loadLogs();
    };

    socket.on('notification:progress', handleEvent);
    socket.on('notification:completed', handleEvent);
    socket.on('notification:failed', handleEvent);
    socket.on('bulk:progress', handleEvent);
    socket.on('bulk:completed', handleEvent);

    return () => {
      socket.off('notification:progress', handleEvent);
      socket.off('notification:completed', handleEvent);
      socket.off('notification:failed', handleEvent);
      socket.off('bulk:progress', handleEvent);
      socket.off('bulk:completed', handleEvent);
    };
  }, [loadLogs]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Notification Logs</h1>
          <p className="text-slate-600 mt-1">
            Real-time view of confirmation emails sent from the system
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Live
        </div>
      </div>

      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Filter by status:</label>
          <select
            className="input max-w-xs"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <button onClick={loadLogs} className="btn-secondary ml-auto">
            Refresh
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Recipient</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Subject</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Template</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Queued at</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No logs yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">
                      {log.recipientName || '—'}
                    </p>
                    <p className="text-xs text-slate-500">{log.recipient}</p>
                  </td>
                  <td className="px-4 py-3 text-sm max-w-xs truncate">
                    {log.subject}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {log.template?.name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={log.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="text-brand-700 text-sm font-medium"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {meta.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Page {page} of {meta.totalPages} ({meta.total} logs)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
                className="btn-secondary text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedLog && (
        <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-700',
    processing: 'bg-blue-100 text-blue-700 animate-pulse',
    success: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`badge ${colors[status] || 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  );
}

function LogDetailModal({
  log,
  onClose,
}: {
  log: NotificationLog;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold">Notification details</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
            ✕
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Recipient</p>
              <p className="font-medium">{log.recipient}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <StatusPill status={log.status} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Queued at</p>
              <p className="text-sm">{new Date(log.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Sent at</p>
              <p className="text-sm">
                {log.sentAt ? new Date(log.sentAt).toLocaleString() : '—'}
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500">Subject</p>
            <p className="font-medium">{log.subject}</p>
          </div>
          {log.errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-700 font-medium mb-1">Error</p>
              <p className="text-sm text-red-900">{log.errorMessage}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500 mb-2">Body</p>
            <div
              className="border border-slate-200 rounded-lg p-4 max-h-64 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: log.body }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
