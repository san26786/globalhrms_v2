'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import DynamicForm from '@/components/DynamicForm/DynamicForm';
import { dashboardMenuFields } from '../../dashboardMenuFields';
import { authFetch } from '@/lib/auth/authFetch';
import type { DashboardMenuDetail } from '@/lib/dashboard-menu/types';

interface DashboardMenuEditForm {
  menuName: string;
  menuUrl: string;
  sequence: string;
}

/**
 * CI: Dashboard_menu::editMenu($id) → initForm($id) (EDIT mode) →
 * Dashboard_menu::edit_menu() on submit.
 */
export default function EditDashboardMenuPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [loading, setLoading] = useState(true);
  const smallIconRef = useRef<HTMLInputElement>(null);
  const mediumIconRef = useRef<HTMLInputElement>(null);
  const blockIconRef = useRef<HTMLInputElement>(null);

  const form = useForm<DashboardMenuEditForm>({
    defaultValues: { menuName: '', menuUrl: '', sequence: '' },
  });

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) return;
    authFetch(`/api/utilities/dashboard-menu/${id}`)
      .then((res) => res.json())
      .then((json) => {
        const data: DashboardMenuDetail | undefined = json.data;
        if (data) {
          form.reset({
            menuName: data.menuName,
            menuUrl: data.url,
            sequence: data.sequence != null ? String(data.sequence) : '',
          });
        }
      })
      .catch((error) => console.error('Failed to load dashboard menu entry', error))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fields = dashboardMenuFields('edit');

  const onSubmit = async (data: DashboardMenuEditForm) => {
    const formData = new FormData();
    formData.set('menuName', data.menuName);
    formData.set('menuUrl', data.menuUrl);
    formData.set('sequence', data.sequence);
    if (smallIconRef.current?.files?.[0]) formData.set('smallIcon', smallIconRef.current.files[0]);
    if (mediumIconRef.current?.files?.[0]) formData.set('mediumIcon', mediumIconRef.current.files[0]);
    if (blockIconRef.current?.files?.[0]) formData.set('blockIcon', blockIconRef.current.files[0]);

    try {
      const res = await authFetch(`/api/utilities/dashboard-menu/${id}`, {
        method: 'PUT',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? 'Failed to update menu');
      }
      toast.success('Successfully update record');
      router.push('/utilities/dashboard-menu');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update menu');
    }
  };

  if (loading) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  return (
    <div className="space-y-4">
      <DynamicForm
        form={form}
        breadcrumb={['Utilities', 'Dashboard Menu']}
        title="Edit Menu"
        mode="edit"
        fields={fields}
        onSubmit={onSubmit}
        onCancel={() => router.push('/utilities/dashboard-menu')}
      />

      <div className="rounded-2xl border bg-white p-6 shadow-sm grid gap-4 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Small Icon (leave blank to keep existing)</span>
          <input ref={smallIconRef} type="file" accept="image/*" className="block w-full text-sm" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Medium Icon (leave blank to keep existing)</span>
          <input ref={mediumIconRef} type="file" accept="image/*" className="block w-full text-sm" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Block Icon (leave blank to keep existing)</span>
          <input ref={blockIconRef} type="file" accept="image/*" className="block w-full text-sm" />
        </label>
      </div>
    </div>
  );
}
