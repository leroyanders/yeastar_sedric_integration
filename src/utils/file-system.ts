import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { join } from 'path';
import { Logger } from '@nestjs/common';

const logger = new Logger('file-system');
const pipelineAsync = promisify(pipeline);
const downloadDirectory = join(__dirname, '..', '..', 'downloads');

const downloadPath = (path: string) => join(downloadDirectory, path);

export const handleFileCleanup = async (filePath: string): Promise<void> => {
  await fs.unlink(downloadPath(filePath));
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

export const saveFile = async (file: NodeJS.ReadableStream, path: string) => {
  const fullPath = downloadPath(path);
  logger.debug(`Saved file at ${fullPath}`);
  await pipelineAsync(file, createWriteStream(fullPath));
  return fullPath;
};
