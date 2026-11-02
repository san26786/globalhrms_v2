import path from 'node:path';
import { ValidationError } from '@/lib/http/errors';
import { imageInfo } from '@/lib/files/imageInfo';
import { empPictureDefs } from '../defs/empPicture';
import type { HubConfig } from '../hubEngine';

/**
 * CI employeeMngt/empPicture ("My Picture"): an employee's pictures (table emp_picture; the stored file
 * name is kept as bytes in EPIC_PICTURE, the files in EMP_PICTURE_DIR — CI's public folder
 * upload/employee_image/). An employee may have several rows; the newest is their picture.
 *
 * Behaviour changes: pictures are served only to users who may see the record, inline only when the
 * bytes really are a JPEG / PNG / GIF / BMP (CI served the folder to anyone and trusted the extension);
 * the file name, type, size and dimensions are read from the upload on the server (CI took them from the
 * browser, often wrong); delete is a soft delete (CI's row icon hard-deleted); TIFF is no longer accepted
 * (browsers cannot show it).
 */
const MAX_BYTES = 10 * 1024 * 1024; // CI 10240 KB

export const empPictureConfig: HubConfig = {
  key: 'empPicture',
  defs: empPictureDefs,
  table: 'emp_picture',
  pk: 'EMP_PICYURE_ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: `convert_from(t."EPIC_PICTURE", 'UTF8') AS "EPIC_PICTURE", t."EPIC_FILENAME", t."EPIC_TYPE", t."EPIC_FILE_SIZE",
    t."EPIC_FILE_WIDTH", t."EPIC_FILE_HEIGHT"`,
  search: ['EPIC_FILENAME', 'EPIC_TYPE'],
  sorts: ['EPIC_FILENAME', 'EPIC_TYPE'],
  bind: {},
  deleteMode: 'soft',
  messages: { created: 'Successfully Added Employee Picture', updated: 'Successfully Updated Employee Picture', deleted: 'Successfully Deleted Employee Picture' },

  attachment: {
    column: 'EPIC_PICTURE',
    store: { envVar: 'EMP_PICTURE_DIR', allowed: new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'jfif']), maxBytes: MAX_BYTES, maxNameLength: 100 },
    prefix: (_id, employee) => `${employee.id}_`,
    required: true,
    inspect(file, bytes) {
      const info = imageInfo(bytes);
      if (!info) throw new ValidationError('The uploaded file is not a valid image.', { userFile: ['The uploaded file is not a valid image.'] });
      if (info.width > 10000 || info.height > 10000) {
        throw new ValidationError('The image dimensions are too large.', { userFile: ['The image dimensions are too large.'] });
      }
      const original = path.basename(file.name);
      return {
        EPIC_FILENAME: original.slice(0, 100),
        EPIC_TYPE: path.extname(original).slice(1).toLowerCase(),
        EPIC_FILE_SIZE: (file.size / 1024).toFixed(2),
        EPIC_FILE_WIDTH: String(info.width),
        EPIC_FILE_HEIGHT: String(info.height),
      };
    },
    inline: (bytes) => imageInfo(bytes)?.mime ?? null,
  },
};
