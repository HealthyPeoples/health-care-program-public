/**
 * Azure Blob Storage 헬퍼 (프로그램일지 사진 등)
 *
 * 환경변수:
 * - AZURE_STORAGE_CONNECTION_STRING  (필수)
 * - AZURE_STORAGE_CONTAINER_NAME     (기본: program-daily-log)
 */

const { BlobServiceClient } = require('@azure/storage-blob');

const DEFAULT_CONTAINER = 'program-daily-log';
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

function getConnectionString() {
  return String(process.env.AZURE_STORAGE_CONNECTION_STRING || '').trim();
}

function getContainerName() {
  return String(process.env.AZURE_STORAGE_CONTAINER_NAME || DEFAULT_CONTAINER).trim() || DEFAULT_CONTAINER;
}

function isBlobConfigured() {
  return Boolean(getConnectionString());
}

function getBlobServiceClient() {
  const cs = getConnectionString();
  if (!cs) {
    throw new Error(
      'Azure Blob Storage가 설정되지 않았습니다. AZURE_STORAGE_CONNECTION_STRING 환경변수를 확인해 주세요.',
    );
  }
  return BlobServiceClient.fromConnectionString(cs);
}

async function getContainerClient() {
  const service = getBlobServiceClient();
  const container = service.getContainerClient(getContainerName());
  await container.createIfNotExists();
  return container;
}

function assertAllowedImage(fileName, mimeType, size) {
  const mime = String(mimeType || '').toLowerCase().trim();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error('허용되지 않는 이미지 형식입니다. (jpeg, png, webp, gif만 가능)');
  }
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('빈 파일은 업로드할 수 없습니다.');
  }
  if (n > MAX_FILE_BYTES) {
    throw new Error('이미지 크기는 8MB 이하여야 합니다.');
  }
  const name = String(fileName || 'image').trim() || 'image';
  return { mime, name };
}

function extFromMime(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
}

function sanitizeBlobPathSegment(v) {
  return String(v ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80);
}

/**
 * @param {{ ancd: string|number, buffer: Buffer, fileName: string, mimeType: string, size?: number }} opts
 * @returns {Promise<{ blobName: string, fileName: string, contentType: string, size: number }>}
 */
async function uploadProgramDailyLogPhoto({ ancd, buffer, fileName, mimeType, size }) {
  const { mime, name } = assertAllowedImage(fileName, mimeType, size ?? buffer?.length);
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('업로드할 이미지 데이터가 없습니다.');
  }

  const container = await getContainerClient();
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  const ext = extFromMime(mime);
  const blobName = `program-daily-log/${sanitizeBlobPathSegment(ancd)}/${stamp}-${rand}.${ext}`;

  const blockBlob = container.getBlockBlobClient(blobName);
  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mime },
  });

  return {
    blobName,
    fileName: name.slice(0, 120),
    contentType: mime,
    size: buffer.length,
  };
}

async function deleteBlobByName(blobName) {
  const name = String(blobName || '').trim();
  if (!name) return false;
  if (!name.startsWith('program-daily-log/')) {
    throw new Error('잘못된 blob 경로입니다.');
  }
  const container = await getContainerClient();
  const blockBlob = container.getBlockBlobClient(name);
  const result = await blockBlob.deleteIfExists();
  return Boolean(result?.succeeded);
}

/**
 * @returns {Promise<{ buffer: Buffer, contentType: string } | null>}
 */
async function downloadBlobByName(blobName) {
  const name = String(blobName || '').trim();
  if (!name || !name.startsWith('program-daily-log/')) {
    return null;
  }
  const container = await getContainerClient();
  const blockBlob = container.getBlockBlobClient(name);
  const exists = await blockBlob.exists();
  if (!exists) return null;
  const download = await blockBlob.download(0);
  const chunks = [];
  for await (const chunk of download.readableStreamBody) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return {
    buffer: Buffer.concat(chunks),
    contentType: download.contentType || 'application/octet-stream',
  };
}

module.exports = {
  isBlobConfigured,
  getContainerName,
  uploadProgramDailyLogPhoto,
  deleteBlobByName,
  downloadBlobByName,
  MAX_FILE_BYTES,
  ALLOWED_MIME,
};
