'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Appointment, PaginatedData } from '@/lib/types';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState({
    upcoming: 0,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
  });
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<{
          data: PaginatedData<Appointment>;
        }>('/appointments', {
          params: { limit: 100, from: new Date().toISOString() },
        });
        const items = res.data.data.data;
        setUpcoming(items.slice(0, 5));
        setStats({
          upcoming: items.length,
          confirmed: items.filter((a) => a.status === 'confirmed').length,
          pending: items.filter((a) => a.status === 'pending').length,
          cancelled: items.filter((a) => a.status === 'cancelled').length,
        });
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Welcome, {user?.firstName}
        </h1>
        <p className="text-slate-600 mt-1">Here&apos;s your salon overview</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Upcoming" value={stats.upcoming} color="brand" />
        <StatCard label="Confirmed" value={stats.confirmed} color="green" />
        <StatCard label="Pending" value={stats.pending} color="yellow" />
        <StatCard label="Cancelled" value={stats.cancelled} color="red" />
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Upcoming appointments</h2>
          <Link
            href="/dashboard/appointments"
            className="text-brand-700 text-sm font-medium"
          >
            View all →
          </Link>
        </div>
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : upcoming.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500 mb-4">No upcoming appointments</p>
            <Link href="/dashboard/appointments" className="btn-primary">
              Book one now
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">{a.service.name}</p>
                  <p className="text-sm text-slate-600">
                    {new Date(a.startTime).toLocaleString()} • {a.customerName}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'brand' | 'green' | 'yellow' | 'red';
}) {
  const colorMap = {
    brand: 'bg-brand-100 text-brand-800',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
  };
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
      <div className={`inline-block w-12 h-1 rounded-full mt-3 ${colorMap[color].split(' ')[0]}`}></div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
    no_show: 'bg-slate-100 text-slate-800',
  };
  return (
    <span className={`badge ${colors[status] || 'bg-slate-100 text-slate-800'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
