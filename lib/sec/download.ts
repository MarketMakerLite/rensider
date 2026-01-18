import { createWriteStream } from 'fs';
import { mkdir, unlink, stat } from 'fs/promises';
import { dirname, join, resolve, relative } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { createGunzip } from 'zlib';
import { fetchFromSEC } from './client';

/**
 * Validate that a path is within the allowed directory (path traversal protection)
 * Throws if the path would escape the destination directory
 */
function assertPathWithinDirectory(destDir: string, filePath: string): string {
  const resolvedDest = resolve(destDir);
  const resolvedPath = resolve(destDir, filePath);

  // Check that resolved path starts with destination directory
  const relativePath = relative(resolvedDest, resolvedPath);
  if (relativePath.startsWith('..') || resolve(relativePath) === relativePath) {
    throw new Error(`Path traversal detected: "${filePath}" escapes destination directory`);
  }

  return resolvedPath;
}

const DATA_DIR = process.env.SEC_DATA_DIR || 'data';

interface DownloadOptions {
  overwrite?: boolean;
  decompress?: boolean;
}

interface DownloadResult {
  path: string;
  size: number;
  cached: boolean;
}

export async function downloadFile(
  url: string,
  destPath: string,
  options: DownloadOptions = {}
): Promise<DownloadResult> {
  const { overwrite = false, decompress = false } = options;
  const fullPath = join(DATA_DIR, destPath);

  // Create directory if needed
  await mkdir(dirname(fullPath), { recursive: true });

  // Check if file already exists
  if (!overwrite) {
    try {
      const stats = await stat(fullPath);
      console.log(`File already exists: ${fullPath} (${stats.size} bytes)`);
      return { path: fullPath, size: stats.size, cached: true };
    } catch {
      // File doesn't exist, continue with download
    }
  }

  console.log(`Downloading: ${url}`);
  const response = await fetchFromSEC(url);

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const tempPath = `${fullPath}.tmp`;

  try {
    // @ts-expect-error - Node.js types don't fully align with web streams
    const nodeStream = Readable.fromWeb(response.body);
    const writeStream = createWriteStream(tempPath);

    if (decompress && (url.endsWith('.gz') || url.endsWith('.gzip'))) {
      await pipeline(nodeStream, createGunzip(), writeStream);
    } else {
      await pipeline(nodeStream, writeStream);
    }

    // Rename temp to final
    const { rename } = await import('fs/promises');
    await rename(tempPath, fullPath);

    const stats = await stat(fullPath);
    console.log(`Downloaded: ${fullPath} (${stats.size} bytes)`);

    return { path: fullPath, size: stats.size, cached: false };
  } catch (error) {
    // Clean up temp file on error
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

export async function downloadZip(url: string, destPath: string): Promise<DownloadResult> {
  return downloadFile(url, destPath, { overwrite: false });
}

interface ExtractedFiles {
  [filename: string]: string;
}

export async function extractZip(zipPath: string, destDir: string): Promise<ExtractedFiles> {
  const { default: unzipper } = await import('unzipper');
  const fullZipPath = join(DATA_DIR, zipPath);
  const fullDestDir = resolve(join(DATA_DIR, destDir));

  await mkdir(fullDestDir, { recursive: true });

  const extractedFiles: ExtractedFiles = {};

  const directory = await unzipper.Open.file(fullZipPath);

  for (const file of directory.files) {
    if (file.type === 'File') {
      // Path traversal protection: validate file path stays within dest directory
      const destPath = assertPathWithinDirectory(fullDestDir, file.path);
      await mkdir(dirname(destPath), { recursive: true });

      await pipeline(
        file.stream(),
        createWriteStream(destPath)
      );

      extractedFiles[file.path] = destPath;
    }
  }

  return extractedFiles;
}

export async function downloadAndExtractZip(
  url: string,
  zipName: string,
  extractDir: string
): Promise<ExtractedFiles> {
  const zipPath = join('raw', zipName);
  await downloadZip(url, zipPath);
  return extractZip(zipPath, extractDir);
}

export function getDataPath(...segments: string[]): string {
  return join(DATA_DIR, ...segments);
}

export async function ensureDataDir(...segments: string[]): Promise<string> {
  const dirPath = getDataPath(...segments);
  await mkdir(dirPath, { recursive: true });
  return dirPath;
}
