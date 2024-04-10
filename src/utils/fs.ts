import fs from 'fs/promises';
import { join } from 'path';

const downloadDirectory = join(__dirname, '..', '..', 'downloads');

export const downloadPath = (path: string) => join(downloadDirectory, path);

export const handleFileCleanup = async (filePath: string): Promise<void> => {
  await fs.unlink(filePath);
};

export const checkFileExists = async (path: string): Promise<boolean> => {
  const fullPath = downloadPath(path);

  return new Promise(async (resolve) => {
    try {
      await fs.access(fullPath, fs.constants.F_OK);
      resolve(true);
    } catch (err) {
      resolve(false);
    }
  });
};
