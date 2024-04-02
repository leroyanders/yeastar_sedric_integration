import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { join } from 'path';

const pipelineAsync = promisify(pipeline);
const downloadDirectory = join(__dirname, '..', 'downloads');

const downloadPath = (path: string) => join(downloadDirectory, path);

export const handleFileCleanup = async (filePath: string): Promise<void> => {
  try {
    await fs.unlink(downloadPath(filePath));
    console.log(`Deleted file at ${filePath}`);
  } catch (err) {
    console.error(`Error deleting file at ${filePath}:`, err);
  }
};

export const checkFileExists = async (path: string): Promise<boolean> => {
  const fullPath = downloadPath(path);

  try {
    await fs.access(fullPath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
};

export const saveFile = async (file: NodeJS.ReadableStream, path: string) => {
  const fullPath = downloadPath(path);
  await pipelineAsync(file, createWriteStream(fullPath));

  return fullPath;
};
