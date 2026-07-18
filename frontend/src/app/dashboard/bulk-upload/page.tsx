'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { BulkProgressPayload, NotificationTemplate } from '@/lib/types';

interface RowLog {
  row: number;
  recipient: string;
  success: boolean;
  error?: string;
}

export default function BulkUploadPage() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<BulkProgressPayload | null>(null);
  const [rows, setRows] = useState<RowLog[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<{ data: NotificationTemplate[] }>('/templates', {
        params: { activeOnly: true },
      })
      .then((res) => {
        setTemplates(res.data.data);
        if (res.data.data[0]) setTemplateId(res.data.data[0].id);
      })
      .catch((err) => toast.error(getErrorMessage(err)));
  }, []);

  useEffect(() => {
    if (!batchId) return;

    const socket = getSocket('notifications');
    socket.emit('subscribe:batch', batchId);

    const onProgress = (data: BulkProgressPayload) => {
      if (data.batchId !== batchId) return;
      setProgress(data);
      if (data.lastRow) {
        setRows((prev) => [
          ...prev,
          {
            row: data.lastRow!.row,
            recipient: data.lastRow!.recipient,
            success: data.lastRow!.success,
            error: data.lastRow!.error,
          },
        ]);
      }
    };

    const onCompleted = (data: BulkProgressPayload) => {
      if (data.batchId !== batchId) return;
      setProgress({ ...data, status: 'completed' });
      toast.success(
        `Bulk complete: ${data.success}/${data.total} succeeded`,
      );
    };

    socket.on('bulk:progress', onProgress);
    socket.on('bulk:completed', onCompleted);

    return () => {
      socket.emit('unsubscribe:batch', batchId);
      socket.off('bulk:progress', onProgress);
      socket.off('bulk:completed', onCompleted);
    };
  }, [batchId]);

  const handleUpload = async () => {
    if (!file) return toast.error('Please choose an Excel file');
    if (!templateId) return toast.error('Please select a template');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('templateId', templateId);

    setUploading(true);
    setRows([]);
    setProgress(null);
    setBatchId(null);

    try {
      const res = await api.post<{
        data: { batchId: string; totalRows: number };
      }>('/notifications/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBatchId(res.data.data.batchId);
      toast.success(`Queued ${res.data.data.totalRows} rows`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const percent = progress
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Bulk Appointment Upload</h1>
      <p className="text-slate-600 mb-6">
        Upload an Excel file to queue multiple appointment confirmations. Watch
        them process live below.
      </p>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <h2 className="font-semibold mb-4">Upload an Excel file</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Confirmation template</label>
              <select
                className="input"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Excel file (.xlsx)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-100 file:text-brand-700 hover:file:bg-brand-200"
              />
              {file && (
                <p className="text-xs text-slate-500 mt-1">
                  Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                </p>
              )}
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading || !file || !templateId}
              className="btn-primary w-full"
            >
              {uploading ? 'Uploading...' : 'Upload & queue'}
            </button>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold mb-3">Required columns</h2>
          <p className="text-sm text-slate-600 mb-3">
            Your file&apos;s first row must include these headers (case-insensitive):
          </p>
          <ul className="text-sm space-y-1">
            <li>
              <code className="bg-slate-100 px-2 py-0.5 rounded">customerEmail</code>{' '}
              <span className="text-red-600">(required)</span>
            </li>
            <li>
              <code className="bg-slate-100 px-2 py-0.5 rounded">serviceName</code>{' '}
              <span className="text-red-600">(required)</span>
            </li>
            <li>
              <code className="bg-slate-100 px-2 py-0.5 rounded">startTime</code>{' '}
              <span className="text-red-600">(required, ISO date)</span>
            </li>
            <li>
              <code className="bg-slate-100 px-2 py-0.5 rounded">customerName</code>
            </li>
            <li>
              <code className="bg-slate-100 px-2 py-0.5 rounded">customerPhone</code>
            </li>
            <li>
              <code className="bg-slate-100 px-2 py-0.5 rounded">notes</code>
            </li>
          </ul>
        </div>
      </div>

      {progress && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">
              Processing batch {batchId?.slice(0, 8)}...
            </h2>
            <span
              className={`badge ${
                progress.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {progress.status}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 mb-3">
            <div
              className="bg-brand-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{progress.processed}</p>
              <p className="text-xs text-slate-500">Processed</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{progress.total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {progress.success}
              </p>
              <p className="text-xs text-slate-500">Success</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{progress.failed}</p>
              <p className="text-xs text-slate-500">Failed</p>
            </div>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="font-semibold">Row-by-row status</h2>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-700">Row</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-700">Recipient</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-700">Status</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-700">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-sm">{r.row}</td>
                  <td className="px-4 py-2 text-sm">{r.recipient}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`badge ${
                        r.success
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {r.success ? 'success' : 'failed'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-slate-600">
                    {r.error || 'Confirmation sent'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
