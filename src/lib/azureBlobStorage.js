/**
 * @file 공유 라이브러리 — azureBlobStorage.js
 *
 * @description
 * API·화면에서 공유하는 도메인 로직 모듈입니다.
 *
 * @module lib/azureBlobStorage
 */
/**
 * Azure Blob Storage 헬퍼
 *
 * 환경변수:
 * - AZURE_STORAGE_CONNECTION_STRING              (필수)
 * - AZURE_STORAGE_CONTAINER_NAME                 (프로그램일지 사진, 기본: program-daily-log)
 * - AZURE_STORAGE_DATA_ROOM_CONTAINER_NAME       (자료실, 기본: data-room)
 */

const { BlobServiceClient } = require('@azure/storage-blob');

const DEFAULT_CONTAINER = 'program-daily-log';
const DEFAULT_DATA_ROOM_CONTAINER = 'data-room';
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 프로그램일지 사진 8MB
const MAX_DATA_ROOM_BYTES = 50 * 1024 * 1024; // 자료실 50MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

const DATA_ROOM_BLOCKED_EXT = new Set([
  'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'ps1', 'vbs', 'js', 'jar', 'sh', 'dll',
]);

function getConnectionString() {
  return String(process.env.AZURE_STORAGE_CONNECTION_STRING || '').trim();
}

function getContainerName() {
  return String(process.env.AZURE_STORAGE_CONTAINER_NAME || DEFAULT_CONTAINER).trim() || DEFAULT_CONTAINER;
}

function getDataRoomContainerName() {
  return (
    String(process.env.AZURE_STORAGE_DATA_ROOM_CONTAINER_NAME || DEFAULT_DATA_ROOM_CONTAINER).trim() ||
    DEFAULT_DATA_ROOM_CONTAINER
  );
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

async function getContainerClientByName(containerName) {
  const service = getBlobServiceClient();
  const container = service.getContainerClient(containerName);
  try {
    await container.createIfNotExists();
  } catch (e) {
    // 계정에서 익명 액세스 금지 등으로 create 옵션이 실패해도, 이미 있으면 사용
    const exists = await container.exists().catch(() => false);
    if (!exists) {
      throw e;
    }
  }
  return container;
}

async function getContainerClient() {
  return getContainerClientByName(getContainerName());
}

async function getDataRoomContainerClient() {
  return getContainerClientByName(getDataRoomContainerName());
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

function extFromFileName(fileName) {
  const s = String(fileName || '');
  const i = s.lastIndexOf('.');
  if (i < 0) return '';
  return s.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
}

/**
 * @param {{ ancd: string|number, buffer: Buffer, fileName: string, mimeType: string, size?: number }} opts
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

/**
 * 욕창관리(F33010.DCUB_IMG) 사진.
 * @param {{ ancd: string|number, buffer: Buffer, fileName: string, mimeType: string, size?: number }} opts
 */
async function uploadBedsorePhoto({ ancd, buffer, fileName, mimeType, size }) {
  const { mime, name } = assertAllowedImage(fileName, mimeType, size ?? buffer?.length);
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('업로드할 이미지 데이터가 없습니다.');
  }

  const container = await getContainerClient();
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  const ext = extFromMime(mime);
  const blobName = `f33010/${sanitizeBlobPathSegment(ancd)}/${stamp}-${rand}.${ext}`;

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

/**
 * 보호자간담회(F60040.MIMG nvarchar(100)) 사진.
 * 경로를 짧게 유지해 DB 길이 제한에 맞춥니다. 예: f60040/190000/m8k2ab12.jpg
 * @param {{ ancd: string|number, buffer: Buffer, fileName: string, mimeType: string, size?: number }} opts
 */
async function uploadGuardianMeetingPhoto({ ancd, buffer, fileName, mimeType, size }) {
  const { mime, name } = assertAllowedImage(fileName, mimeType, size ?? buffer?.length);
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('업로드할 이미지 데이터가 없습니다.');
  }

  const container = await getContainerClient();
  const stamp = Date.now().toString(36).slice(-6);
  const rand = Math.random().toString(36).slice(2, 6);
  const ext = extFromMime(mime);
  const blobName = `f60040/${sanitizeBlobPathSegment(ancd)}/${stamp}${rand}.${ext}`;
  if (blobName.length > 100) {
    throw new Error('사진 경로가 너무 깁니다. 기관코드를 확인해 주세요.');
  }

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

/**
 * 자료실 파일 → 전용 컨테이너(data-room)에 기관코드 폴더로 저장
 * 사진(program-daily-log/{ancd}/...)과 동일하게 기관코드가 가상 폴더가 됩니다.
 * blobName 예: 190000/ms6c1a-ab12cd_서식.xlsx
 */
async function uploadDataRoomFile({ ancd, buffer, fileName, mimeType, size }) {
  const name = String(fileName || 'file').trim() || 'file';
  const n = Number(size ?? buffer?.length);
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || !Number.isFinite(n) || n <= 0) {
    throw new Error('업로드할 파일이 없습니다.');
  }
  if (n > MAX_DATA_ROOM_BYTES) {
    throw new Error('파일 크기는 50MB 이하여야 합니다.');
  }
  const facilityFolder = sanitizeBlobPathSegment(ancd);
  if (!facilityFolder) {
    throw new Error('기관코드(ANCD)가 없어 Blob 폴더를 만들 수 없습니다.');
  }
  const ext = extFromFileName(name);
  if (ext && DATA_ROOM_BLOCKED_EXT.has(ext)) {
    throw new Error('실행 파일 등 허용되지 않는 확장자입니다.');
  }

  const mime = String(mimeType || 'application/octet-stream').trim() || 'application/octet-stream';
  const container = await getDataRoomContainerClient();
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  const safeExt = ext || 'bin';
  // 원본 파일명(확장자 제외)을 경로에 남겨 Azure 포털에서도 구분 가능
  const baseName = sanitizeBlobPathSegment(name.replace(/\.[^.]+$/, '')) || 'file';
  // 기관코드 폴더 / 고유파일명  (예: 190000/ms6c1a-ab12_입소자_서식.xlsx)
  const blobName = `${facilityFolder}/${stamp}-${rand}_${baseName}.${safeExt}`;

  const blockBlob = container.getBlockBlobClient(blobName);
  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mime },
  });

  return {
    blobName,
    fileName: name.slice(0, 260),
    contentType: mime.slice(0, 120),
    size: buffer.length,
    containerName: getDataRoomContainerName(),
  };
}

function isProgramDailyLogBlob(blobName) {
  return String(blobName || '').trim().startsWith('program-daily-log/');
}

function isGuardianMeetingBlob(blobName) {
  return String(blobName || '').trim().startsWith('f60040/');
}

function isBedsorePhotoBlob(blobName) {
  return String(blobName || '').trim().startsWith('f33010/');
}

function isSharedPhotoBlob(blobName) {
  return isProgramDailyLogBlob(blobName) || isGuardianMeetingBlob(blobName) || isBedsorePhotoBlob(blobName);
}

/** 자료실 blob 경로 형식 검증 (기관코드 폴더 하위) */
function isValidDataRoomBlobName(blobName) {
  const name = String(blobName || '').trim();
  if (!name || name.includes('..') || name.startsWith('/')) return false;
  // 기관코드 폴더: 190000/xxx.ext
  if (/^[a-zA-Z0-9._-]+\//.test(name)) return true;
  // 과거: data-room/190000/xxx.ext (동일/타 컨테이너)
  if (/^data-room\/[a-zA-Z0-9._-]+\//.test(name)) return true;
  return false;
}

/** @deprecated 세션 ANCD 고정 검증 — 자료실 공유 후에는 isValidDataRoomBlobName 사용 */
function assertDataRoomBlobName(blobName, ownerAncd) {
  const name = String(blobName || '').trim();
  if (!name || name.includes('..')) return null;
  if (ownerAncd == null || ownerAncd === '') {
    return isValidDataRoomBlobName(name) ? name : null;
  }
  const prefix = `${String(ownerAncd).trim()}/`;
  if (name.startsWith(prefix)) return name;
  const legacy = `data-room/${prefix}`;
  if (name.startsWith(legacy)) return name;
  return null;
}

async function deleteBlobByName(blobName) {
  const name = String(blobName || '').trim();
  if (!name) return false;

  if (isSharedPhotoBlob(name)) {
    const container = await getContainerClient();
    const result = await container.getBlockBlobClient(name).deleteIfExists();
    return Boolean(result?.succeeded);
  }

  // 자료실: 전용 컨테이너
  const container = await getDataRoomContainerClient();
  // 과거 경로가 program-daily-log 컨테이너에 남아 있을 수 있음 → 둘 다 시도
  let result = await container.getBlockBlobClient(name).deleteIfExists();
  if (!result?.succeeded && name.startsWith('data-room/')) {
    const legacyContainer = await getContainerClient();
    result = await legacyContainer.getBlockBlobClient(name).deleteIfExists();
  }
  return Boolean(result?.succeeded);
}

/**
 * 프로그램일지 사진용 (program-daily-log 컨테이너)
 */
async function downloadBlobByName(blobName) {
  const name = String(blobName || '').trim();
  if (!name || !isSharedPhotoBlob(name)) return null;
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

/**
 * 자료실 파일 다운로드 (data-room 컨테이너)
 */
async function downloadDataRoomBlob(blobName) {
  const name = String(blobName || '').trim();
  if (!name) return null;

  const tryDownload = async (containerClient, path) => {
    const blockBlob = containerClient.getBlockBlobClient(path);
    if (!(await blockBlob.exists())) return null;
    const download = await blockBlob.download(0);
    const chunks = [];
    for await (const chunk of download.readableStreamBody) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return {
      buffer: Buffer.concat(chunks),
      contentType: download.contentType || 'application/octet-stream',
    };
  };

  // 1) 전용 data-room 컨테이너
  const dataRoom = await getDataRoomContainerClient();
  let file = await tryDownload(dataRoom, name);
  if (file) return file;

  // 2) 과거: program-daily-log 컨테이너 + data-room/ 접두 경로
  if (name.startsWith('data-room/')) {
    const legacy = await getContainerClient();
    file = await tryDownload(legacy, name);
    if (file) return file;
  }

  return null;
}

module.exports = {
  isBlobConfigured,
  getContainerName,
  getDataRoomContainerName,
  uploadProgramDailyLogPhoto,
  uploadBedsorePhoto,
  uploadGuardianMeetingPhoto,
  uploadDataRoomFile,
  isGuardianMeetingBlob,
  deleteBlobByName,
  downloadBlobByName,
  downloadDataRoomBlob,
  assertDataRoomBlobName,
  isValidDataRoomBlobName,
  MAX_FILE_BYTES,
  MAX_DATA_ROOM_BYTES,
  ALLOWED_MIME,
};
