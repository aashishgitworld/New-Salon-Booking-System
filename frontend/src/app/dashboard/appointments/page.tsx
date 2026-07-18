'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import {
  Appointment,
  AvailableSlotsResponse,
  PaginatedData,
  Service,
  TimeSlot,
} from '@/lib/types';
import { StatusBadge } from '../page';

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  useEffect(() => {
    loadServices();
    loadAppointments();

    const socket = getSocket('appointments');
    socket.on('appointment:created', () => loadAppointments());
    socket.on('appointment:updated', () => loadAppointments());

    return () => {
      socket.off('appointment:created');
      socket.off('appointment:updated');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadServices = async () => {
    try {
      const res = await api.get<{ data: Service[] }>('/services', {
        params: { activeOnly: true },
      });
      setServices(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const loadAppointments = async () => {
    try {
      const res = await api.get<{ data: PaginatedData<Appointment> }>(
        '/appointments',
        { params: { limit: 100 } },
      );
      setAppointments(res.data.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this appointment?')) return;
    try {
      await api.delete(`/appointments/${id}`);
      toast.success('Appointment cancelled');
      loadAppointments();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Appointments</h1>
          <p className="text-slate-600 mt-1">
            Manage your salon bookings and check live availability
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowBookingModal(true);
          }}
          className="btn-primary"
        >
          + New appointment
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Service</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Customer</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">When</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : appointments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No appointments yet.
                </td>
              </tr>
            ) : (
              appointments.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{a.service.name}</p>
                    <p className="text-xs text-slate-500">
                      {a.service.durationMinutes} min · ${a.service.price}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{a.customerName}</p>
                    <p className="text-xs text-slate-500">{a.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(a.startTime).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {a.status !== 'cancelled' && a.status !== 'completed' && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setEditing(a);
                            setShowBookingModal(true);
                          }}
                          className="text-brand-700 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleCancel(a.id)}
                          className="text-red-600 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showBookingModal && (
        <BookingModal
          services={services}
          editing={editing}
          onClose={() => {
            setShowBookingModal(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowBookingModal(false);
            setEditing(null);
            loadAppointments();
          }}
        />
      )}
    </div>
  );
}

function BookingModal({
  services,
  editing,
  onClose,
  onSaved,
}: {
  services: Service[];
  editing: Appointment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [serviceId, setServiceId] = useState(
    editing?.serviceId || services[0]?.id || '',
  );
  const [date, setDate] = useState(
    editing
      ? new Date(editing.startTime).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>(
    editing?.startTime || '',
  );
  const [notes, setNotes] = useState(editing?.notes || '');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!serviceId || !date) return;
    setLoadingSlots(true);
    setSelectedSlot(editing?.startTime || '');
    api
      .get<{ data: AvailableSlotsResponse }>(
        '/appointments/available-slots',
        { params: { serviceId, date } },
      )
      .then((res) => setSlots(res.data.data.slots))
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoadingSlots(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, date]);

  const handleSubmit = async () => {
    if (!selectedSlot) {
      toast.error('Please select a time slot');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { serviceId, startTime: selectedSlot, notes };
      if (editing) {
        await api.patch(`/appointments/${editing.id}`, payload);
        toast.success('Appointment updated');
      } else {
        await api.post('/appointments', payload);
        toast.success('Appointment booked');
      }
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-bold">
            {editing ? 'Edit appointment' : 'Book an appointment'}
          </h2>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="label">Service</label>
            <select
              className="input"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMinutes} min · ${s.price})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Available slots</label>
            {loadingSlots ? (
              <p className="text-slate-500">Loading slots...</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                {slots.map((slot) => {
                  const time = new Date(slot.startTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const isSelected = selectedSlot === slot.startTime;
                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => setSelectedSlot(slot.startTime)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                        isSelected
                          ? 'bg-brand-700 text-white border-brand-700'
                          : slot.available
                            ? 'bg-white text-slate-700 border-slate-300 hover:border-brand-400'
                            : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      }`}
                      title={
                        !slot.available
                          ? slot.reason === 'break'
                            ? 'Break period'
                            : slot.reason === 'booked'
                              ? 'Already booked'
                              : slot.reason === 'past'
                                ? 'Past time'
                                : 'Unavailable'
                          : ''
                      }
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-2 flex gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-white border border-slate-300 rounded"></span>
                Available
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-slate-100 border border-slate-200 rounded"></span>
                Unavailable (booked / break / past)
              </span>
            </div>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests..."
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedSlot}
            className="btn-primary"
          >
            {submitting
              ? 'Saving...'
              : editing
                ? 'Update appointment'
                : 'Book appointment'}
          </button>
        </div>
      </div>
    </div>
  );
}
