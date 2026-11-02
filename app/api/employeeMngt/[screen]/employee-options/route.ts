import { readQuery, withApi } from '@/lib/http/withApi';
import { hubFor } from '@/lib/employeeMngt/hub/registry';

/**
 * Employee Hub record screens — dropdowns that depend on the chosen employee (Dependents / Emergency
 * Contacts: the employee's relatives, with their details for prefilling). ?emp = employee, ?id = record.
 */
export const GET = withApi<{ screen: string }>(async ({ req, params, subject }) => {
  const { emp, id } = readQuery(req);
  return hubFor(params.screen).employeeForm(subject, emp ?? '', id || undefined);
});
