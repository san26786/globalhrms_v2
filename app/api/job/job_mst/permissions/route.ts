import { withApi } from '@/lib/http/withApi';
import { hubFor } from '@/lib/employeeMngt/hub/registry';

/**
 * GET → what the caller may do on Job Detail ({ create, update, delete }: its menu grant, admins only).
 * Confirmation Pending reads it to offer CI's row Delete, which it sends to Job Detail's own DELETE.
 */
export const GET = withApi(async ({ subject }) => hubFor('job_mst').permissions(subject));
