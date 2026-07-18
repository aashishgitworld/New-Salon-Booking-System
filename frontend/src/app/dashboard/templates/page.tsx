'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';
import { Appointment, NotificationTemplate, PaginatedData } from '@/lib/types';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<NotificationTemplate | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [tRes, aRes] = await Promise.all([
          api.get<{ data: NotificationTemplate[] }>('/templates', {
            params: { activeOnly: true },
          }),
          api.get<{ data: PaginatedData<Appointment> }>('/appointments', {
            params: { limit: 50 },
          }),
        ]);
        setTemplates(tRes.data.data);
        setAppointments(aRes.data.data.data);
        if (tRes.data.data[0]) setSelectedTemplate(tRes.data.data[0]);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSend = async () => {
    if (!selectedTemplate || !selectedAppointment) {
      toast.error('Please select a template and an appointment');
      return;
    }
    setSending(true);
    try {
      await api.post('/notifications/send-confirmation', {
        templateId: selectedTemplate.id,
        appointmentId: selectedAppointment,
      });
      toast.success('Confirmation queued — check the logs page for status');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const renderedPreview = () => {
    if (!selectedTemplate) return '';
    const apt = appointments.find((a) => a.id === selectedAppointment);
    const ctx: Record<string, string> = {
      customerName: apt?.customerName ?? 'John Doe',
      serviceName: apt?.service.name ?? 'Haircut',
      startTime: apt ? new Date(apt.startTime).toLocaleString() : 'Sample time',
      endTime: apt ? new Date(apt.endTime).toLocaleString() : '',
      durationMinutes: String(apt?.service.durationMinutes ?? 30),
      price: String(apt?.service.price ?? 0),
    };
    return selectedTemplate.body.replace(
      /\{\{\s*(\w+)\s*\}\}/g,
      (_, k) => ctx[k] ?? '',
    );
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Notification Templates</h1>
      <p className="text-slate-600 mb-6">
        Select a template and an appointment to queue a confirmation email
      </p>

      <div className="grid grid-cols-3 gap-6">
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Available templates</h2>
          <div className="space-y-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t)}
                className={`w-full text-left p-3 rounded-lg transition ${
                  selectedTemplate?.id === t.id
                    ? 'bg-brand-100 border-2 border-brand-500'
                    : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                }`}
              >
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-slate-500 capitalize">{t.type}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-2 space-y-6">
          {selectedTemplate && (
            <>
              <div className="card p-6">
                <h2 className="font-semibold mb-4">Template preview</h2>
                <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Subject</p>
                  <p className="font-medium">{selectedTemplate.subject}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4">
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderedPreview() }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Placeholders supported:{' '}
                  <code className="bg-slate-100 px-1 rounded">
                    {'{{customerName}}'}
                  </code>
                  ,{' '}
                  <code className="bg-slate-100 px-1 rounded">
                    {'{{serviceName}}'}
                  </code>
                  ,{' '}
                  <code className="bg-slate-100 px-1 rounded">
                    {'{{startTime}}'}
                  </code>
                  , etc.
                </p>
              </div>

              <div className="card p-6">
                <h2 className="font-semibold mb-4">Send confirmation</h2>
                <div className="space-y-4">
                  <div>
                    <label className="label">Choose an appointment</label>
                    <select
                      className="input"
                      value={selectedAppointment}
                      onChange={(e) => setSelectedAppointment(e.target.value)}
                    >
                      <option value="">-- Select --</option>
                      {appointments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.customerName} · {a.service.name} ·{' '}
                          {new Date(a.startTime).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={sending || !selectedAppointment}
                    className="btn-primary"
                  >
                    {sending ? 'Queuing...' : 'Queue confirmation'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
