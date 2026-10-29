'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight, Settings, Trash2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BreadcrumbHeader from '@/lib/page-builder/pageBreadcrumbHeader';
import type { ColumnSetting } from '@/lib/import-export/ExportService';
import { useNavigation } from '@/lib/navigation/NavigationContext';
import { useCurrentSession } from '@/lib/header/HeaderSessionContext';
import FormSettingsModal from './FormSettingsModal';

/**
 * Generic list screen — the behaviour of CI include/listview_v.php (+ the footer_v #configform
 * modal) on this app's existing list UI (BreadcrumbHeader card + DataTable):
 *
 *   BreadcrumbHeader: breadcrumb (Home › module › screen from the menu trail), title,
 *                     export/import, Add, then [listActions…] [Form Settings cog] [Delete Selected] [Next Tab]
 *   tabs slot      (CI $emp_tabs / $all_tabs)
 *   filters slot   (CI $customFields)
 *   table slot     (CI generateTable() → the shared <DataTable/>)
 *   footer buttons (CI $showFooterButtons repeats $listActions)
 *
 * Every piece is prop-driven; module-specific buttons (e.g. Employee Manager's Policy Document
 * menu) go in `listActions` or the `extraActions` slot — nothing is hard-coded per module.
 *
 * CI QUIRK (documented, not reproduced): listview_v wrapped filters + table in ONE <form id="formId">
 * whose action defaulted to common_c/softDelete/{pvs_ObjNm}/{firstParameter}/NULL, and every
 * `type: 'button'` list action submitted that same form — so an action that forgot its own
 * `formaction` soft-deleted the selected rows instead. There is no shared form here: each list
 * action must declare its own `href` or `onClick` (enforced by the ListAction type), and
 * "Delete Selected" only runs `onDeleteSelected`.
 */

interface ListActionBase {
  /** Stable key (defaults to the title). */
  key?: string;
  /** CI $action['title'] — tooltip / footer button text. */
  title: string;
  /** CI $action['icon'] (FontAwesome) → lucide icon. */
  icon: LucideIcon;
  disabled?: boolean;
}

/** CI list action: a link (`type` != 'button') or a handler (`type` == 'button' + formaction). */
export type ListAction =
  | (ListActionBase & { href: string; target?: '_blank' | '_self'; download?: boolean; onClick?: never })
  | (ListActionBase & { onClick: () => void; href?: never; target?: never; download?: never });

export interface ListExportConfig {
  /** Module slug for the export/import controls. */
  entity: string;
  filename: string;
  columnSettings: ColumnSetting[];
  data: unknown[];
  tableRef?: unknown;
  onImported?: () => void;
}

export interface ListViewShellProps {
  /** CI $title. */
  title: string;
  /**
   * CI $listActions. An action with key 'add' and an href becomes the header's standard Add (+)
   * button; the others render as icon buttons after it.
   */
  listActions?: ListAction[];
  /** Free slot for module-specific controls (dropdowns etc.) next to the list actions. */
  extraActions?: ReactNode;
  /** CI $export: export controls; `false` hides them. */
  exportConfig?: ListExportConfig | false;
  /** CI $pvs_ObjNm: the entity object whose column settings the cog edits. Omit = no cog. */
  objectName?: string;
  /** CI $configForm: `false` hides the cog even for admins. */
  configForm?: boolean;
  /** Called after the column settings were saved/reset (re-read the list's columns). */
  onConfigSaved?: () => void;
  /** CI "Delete Selected": omit (or CI $deleteAll === false) to hide it. */
  onDeleteSelected?: () => void;
  /** Number of selected rows; Delete Selected is disabled at 0. */
  selectedCount?: number;
  /** CI $empMasterTab "Next Tab" chevron. */
  nextTabHref?: string;
  /** CI $emp_tabs / $all_tabs. */
  tabs?: ReactNode;
  /** CI $customFields (filter row). */
  filters?: ReactNode;
  /** CI $showFooterButtons: repeat listActions as buttons below the table. */
  showFooterButtons?: boolean;
  /** The table (CI generateTable / $customTable). */
  children: ReactNode;
}

// Same look as the header's existing export / add buttons.
const ICON_BTN =
  'rounded-full border-slate-200 dark:border-white/10 hover:bg-slate-50 brand:hover:bg-[#f6f7f9] dark:hover:bg-white/5 text-slate-600 brand:text-[#323338] dark:text-[#d5dae4] shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer';

function HeaderActionButton({ action }: { action: ListAction }) {
  const Icon = action.icon;
  const icon = <Icon className="h-5 w-5" />;
  if (action.href !== undefined) {
    if (action.disabled) {
      return (
        <Button variant="outline" size="icon" className={ICON_BTN} title={action.title} aria-label={action.title} disabled>
          {icon}
        </Button>
      );
    }
    const external = action.target === '_blank' || action.download;
    return (
      <Button asChild variant="outline" size="icon" className={ICON_BTN} title={action.title}>
        {external ? (
          <a href={action.href} target={action.target} download={action.download || undefined} rel="noopener noreferrer" aria-label={action.title}>
            {icon}
          </a>
        ) : (
          <Link href={action.href} aria-label={action.title}>
            {icon}
          </Link>
        )}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="icon" className={ICON_BTN} title={action.title} aria-label={action.title} disabled={action.disabled} onClick={action.onClick}>
      {icon}
    </Button>
  );
}

function FooterActionButton({ action }: { action: ListAction }) {
  const Icon = action.icon;
  const content = (
    <>
      <Icon className="mr-1 h-4 w-4" /> {action.title}
    </>
  );
  if (action.href !== undefined) {
    return (
      <Button asChild={!action.disabled} disabled={action.disabled}>
        {action.disabled ? content : <Link href={action.href}>{content}</Link>}
      </Button>
    );
  }
  return (
    <Button disabled={action.disabled} onClick={action.onClick}>
      {content}
    </Button>
  );
}

export default function ListViewShell({
  title,
  listActions = [],
  extraActions,
  exportConfig,
  objectName,
  configForm = true,
  onConfigSaved,
  onDeleteSelected,
  selectedCount = 0,
  nextTabHref,
  tabs,
  filters,
  showFooterButtons = false,
  children,
}: ListViewShellProps) {
  const { activeTrail } = useNavigation();
  const session = useCurrentSession();
  const [configOpen, setConfigOpen] = useState(false);

  // CI: cog only when is_admin != 0 and $configForm !== false.
  const showConfig = !!objectName && configForm && !!session && session.userLevel !== 0;

  // CI get_breadcrumb_for_list_view(): parent menu › this menu item.
  const leaf = activeTrail[activeTrail.length - 1];
  const parentNode = activeTrail.length > 1 ? activeTrail[activeTrail.length - 2] : null;
  const parent =
    leaf && parentNode
      ? { parentName: parentNode.name, menuName: leaf.name, returnedUrl: leaf.link.kind === 'internal' ? leaf.link.href : '#' }
      : null;

  const addAction = listActions.find((a) => a.key === 'add' && a.href !== undefined && !a.disabled);
  const otherActions = listActions.filter((a) => a !== addAction);

  const headerActions = (
    <>
      {otherActions.map((action) => (
        <HeaderActionButton key={action.key ?? action.title} action={action} />
      ))}
      {extraActions}
      {showConfig && (
        <Button variant="outline" size="icon" className={ICON_BTN} title="Configuration" aria-label="Configuration" onClick={() => setConfigOpen(true)}>
          <Settings className="h-5 w-5" />
        </Button>
      )}
      {onDeleteSelected && (
        <Button
          variant="outline"
          size="icon"
          className={ICON_BTN}
          title={selectedCount ? `Delete Selected (${selectedCount})` : 'Delete Selected'}
          aria-label="Delete Selected"
          disabled={selectedCount === 0}
          onClick={onDeleteSelected}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      )}
      {nextTabHref && (
        <Button asChild variant="outline" size="icon" className={ICON_BTN} title="Next Tab">
          <Link href={nextTabHref} aria-label="Next Tab">
            <ChevronRight className="h-5 w-5" />
          </Link>
        </Button>
      )}
    </>
  );

  return (
    <div className="container mx-auto p-4 space-y-6">
      <BreadcrumbHeader
        entity={exportConfig ? exportConfig.entity : ''}
        title={title}
        filename={exportConfig ? exportConfig.filename : ''}
        columnSettings={exportConfig ? exportConfig.columnSettings : []}
        data={exportConfig ? exportConfig.data : []}
        tableRef={exportConfig ? exportConfig.tableRef : undefined}
        onSuccess={exportConfig ? exportConfig.onImported : undefined}
        showImportExport={!!exportConfig}
        parent={parent}
        addHref={addAction?.href}
        actions={headerActions}
      />

      {tabs}
      {filters}

      {children}

      {showFooterButtons && listActions.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          {listActions.map((action) => (
            <FooterActionButton key={action.key ?? action.title} action={action} />
          ))}
        </div>
      )}

      {showConfig && objectName && (
        <FormSettingsModal objectName={objectName} open={configOpen} onOpenChange={setConfigOpen} onSaved={onConfigSaved} />
      )}
    </div>
  );
}
