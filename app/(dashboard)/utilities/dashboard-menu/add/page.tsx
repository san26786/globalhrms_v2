'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import DynamicForm from '@/components/DynamicForm/DynamicForm';
import { dashboardMenuFields } from '../dashboardMenuFields';
import { authFetch } from '@/lib/auth/authFetch';

interface DashboardMenuAddForm {
  parentModuleId: string;
  menuCode: string;
  menuName: string;
  menuUrl: string;
  sequence: string;
}

/**
 * CI: Dashboard_menu::newMenu() → initForm(0) (ADD mode) →
 * Dashboard_menu::create_menu() on submit.
 */
export default function AddDashboardMenuPage() {
  const router = useRouter();
  const [parentOptions, setParentOptions] = useState<{ label: string; value: string | number }[]>([]);

  const smallIconRef = useRef<HTMLInputElement>(null);
  const mediumIconRef = useRef<HTMLInputElement>(null);
  const blockIconRef = useRef<HTMLInputElement>(null);

  const form = useForm<DashboardMenuAddForm>({
    defaultValues: {
      parentModuleId: '',
      menuCode: '',
      menuName: '',
      menuUrl: '',
      sequence: '',
    },
  });

  useEffect(() => {
    // CI: Dashboard_menu::initForm() → getChildMenu(PARENT_MENU_ID) for the
    // "Parent Module" dropdown.
    authFetch('/api/utilities/dashboard-menu/parent-options')
      .then((res) => res.json())
      .then((json) => setParentOptions(json.data ?? []))
      .catch((error) => console.error('Failed to load parent module options', error));
  }, []);

  const fields = dashboardMenuFields('add', parentOptions);

  const onSubmit = async (data: DashboardMenuAddForm) => {
    const formData = new FormData();
    if (data.parentModuleId) formData.set('parentModuleId', data.parentModuleId);
    formData.set('menuCode', data.menuCode);
    formData.set('menuName', data.menuName);
    formData.set('menuUrl', data.menuUrl);
    formData.set('sequence', data.sequence);
    if (smallIconRef.current?.files?.[0]) formData.set('smallIcon', smallIconRef.current.files[0]);
    if (mediumIconRef.current?.files?.[0]) formData.set('mediumIcon', mediumIconRef.current.files[0]);
    if (blockIconRef.current?.files?.[0]) formData.set('blockIcon', blockIconRef.current.files[0]);

    try {
      const res = await authFetch('/api/utilities/dashboard-menu', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? 'Failed to create menu');
      }
      toast.success('Successfully Added');
      router.push('/utilities/dashboard-menu');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create menu');
    }
  };

  return (
    <div className="space-y-4">
      <DynamicForm
        form={form}
        title="Add New Create Menu"
        mode="add"
        fields={fields}
        onSubmit={onSubmit}
        onCancel={() => router.push('/utilities/dashboard-menu')}
      />

      {/* CI: 3 separate <input type="file"> controls (userfile / userfile1 /
          userfile3) with onchange="showimagepreview(...)". Kept as plain
          file inputs alongside DynamicForm — see dashboardMenuFields.ts for
          why these aren't expressed as DynamicForm fields. */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm grid gap-4 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Small Icon</span>
          <input ref={smallIconRef} type="file" accept="image/*" className="block w-full text-sm" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Medium Icon</span>
          <input ref={mediumIconRef} type="file" accept="image/*" className="block w-full text-sm" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Block Icon</span>
          <input ref={blockIconRef} type="file" accept="image/*" className="block w-full text-sm" />
        </label>
      </div>
    </div>
  );
}
