// Serializable extras an initForm payload can carry besides the fields (shared by server and client).
//
//   FormButton — CI formview_v $data['buttons']: workflow actions on the record (Request Approval,
//                Approve / Reject with a comment, Copy …). Posted by the shared form page; the
//                endpoint decides and answers { message, redirect? }.
//   FormTable  — CI formview_v $data['tableHeader'] / ['tableBody'] / ['tableActions']: a child
//                table shown under the form (e.g. a timesheet's items) with Add / Edit / Delete.
//
// Plain data only, so an init endpoint can send it as JSON and any module can reuse it.

export type FormButtonIcon = "approve" | "reject" | "send" | "copy" | "clone" | "check" | "plus" | "refresh" | "view" | "projects" | "tasks";

export interface FormButtonPrompt {
  /** Body key the entered text is posted as. */
  name: string;
  /** Dialog title and input label (CI modal, e.g. "Approver Comments"). */
  label: string;
  required?: boolean;
  /** Initial text (e.g. the comment already saved). */
  value?: string;
}

export interface FormButton {
  key: string;
  label: string;
  icon?: FormButtonIcon;
  variant?: "primary" | "success" | "danger" | "default";
  /** Action endpoint; the shared page sends `method` (default POST) with a JSON body. */
  url?: string;
  /** CI 'type' => 'link': a page link instead of an action (`url` is then ignored). */
  href?: string;
  method?: "POST" | "PUT" | "DELETE";
  /** Ask before running (window.confirm text). */
  confirm?: string;
  /** Ask for a text first (CI modal form), posted as { [prompt.name]: text }. */
  prompt?: FormButtonPrompt;
  /**
   * After success: "reload" re-runs the init (default), "list" returns to the list page, or a path.
   * A `redirect` in the response data wins.
   */
  then?: "reload" | "list" | string;
}

export interface FormTableColumn {
  name: string;
  label: string;
}

export interface FormTable {
  key: string;
  title: string;
  columns: FormTableColumn[];
  rows: Array<Record<string, unknown>>;
  /** Row field holding the child id (Edit / Delete). */
  rowKey: string;
  /** CI tableActions "Add Items": a page link; null hides it. */
  addHref?: string | null;
  addLabel?: string;
  /** CI tableEditUrl: `${editHref}/${row[rowKey]}`; null hides Edit. */
  editHref?: string | null;
  /** CI tableDeleteUrl: DELETE `${deleteApi}/${row[rowKey]}`; null hides Delete. */
  deleteApi?: string | null;
  emptyText?: string;
}
