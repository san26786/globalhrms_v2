import Breadcrumb from './Breadcrumb';
import type { ParentMenuInfo } from '@/lib/breadcrumb/types';

interface ListViewProps {
  passedUrl?: string | null;
  parameters?: string | null;
  parent?: ParentMenuInfo | null;
}
export function BreadcrumbForListView(props: ListViewProps) {
  return <Breadcrumb mode="list" {...props} />;
}

interface FormViewProps extends ListViewProps {
  mode: 'add' | 'edit' | 'view';
}
export function BreadcrumbForFormView(props: FormViewProps) {
  return <Breadcrumb {...props} />;
}

export { Breadcrumb };