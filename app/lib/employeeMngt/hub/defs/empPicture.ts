import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/empPicture — an employee's pictures (columns of emp_picture_vw). */
export const empPictureDefs: HubScreenDefs = {
  fields: [{ name: 'userFile', label: 'Picture', type: 'file', required: true, attribute: 'EPIC_PICTURE' }],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Full Name', attribute: 'EMP_NAME', sortable: true },
    { key: 'EPIC_PICTURE', header: 'Picture' },
    { key: 'EPIC_FILENAME', header: 'File Name', sortable: true },
    { key: 'EPIC_TYPE', header: 'File Type', sortable: true },
    { key: 'EPIC_FILE_SIZE', header: 'File Size (KB)' },
    { key: 'EPIC_FILE_WIDTH', header: 'File Width' },
    { key: 'EPIC_FILE_HEIGHT', header: 'File Height' },
    { key: 'OA_BRAND_CD', header: 'Brand' },
  ],
  file: { image: true, required: true },
};
