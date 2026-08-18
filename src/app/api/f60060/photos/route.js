/**
 * @file API /api/f60060/photos — 직원직무교육 사진
 *
 * @description
 * F60060.MIMG에 저장할 blob 경로를 업로드·조회·삭제합니다.
 *
 * @module app/api/f60060/photos/route
 */
import { assertAnCdMatchesSession } from '../../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../../utils/apiResponse';

const {
  isBlobConfigured,
  uploadEmployeeJobTrainingPhoto,
  deleteBlobByName,
  downloadBlobByName,
  MAX_FILE_BYTES,
} = require('../../../../lib/azureBlobStorage');

const MAX_PHOTOS = 3;

function requireSession(req) {
  const gate = assertAnCdMatchesSession(req, null);
  if (!gate.ok) return { ok: false, response: gate.response };
  return { ok: true, sessionAncd: gate.sessionAncd };
}

function assertBlobPathOwnedBySession(blobName, sessionAncd) {
  const name = String(blobName || '').trim();
  const ancd = String(sessionAncd ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80);
  const prefix = `f60060/${ancd}/`;
  if (!name.startsWith(prefix) || name.includes('..')) {
    return false;
  }
  return true;
}

/** GET ?blobName=... — 세션 소유 blob 이미지 스트림 */
export async function GET(req) {
  try {
    const session = requireSession(req);
    if (!session.ok) return session.response;

    if (!isBlobConfigured()) {
      return jsonError({ success: false, error: 'Azure Blob Storage가 설정되지 않았습니다.' }, 503);
    }

    const blobName = req.nextUrl.searchParams.get('blobName') || '';
    if (!assertBlobPathOwnedBySession(blobName, session.sessionAncd)) {
      return jsonError({ success: false, error: '권한이 없거나 잘못된 사진 경로입니다.' }, 403);
    }

    const file = await downloadBlobByName(blobName);
    if (!file) {
      return jsonError({ success: false, error: '사진을 찾을 수 없습니다.' }, 404);
    }

    const bytes = file.buffer instanceof Uint8Array ? file.buffer : new Uint8Array(file.buffer);

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': file.contentType || 'image/jpeg',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err) {
    console.error('직원직무교육 사진 조회 오류:', err);
    return jsonError({ success: false, error: err.message || '사진 조회 실패' });
  }
}

/** POST multipart: file — 업로드 */
export async function POST(req) {
  try {
    const session = requireSession(req);
    if (!session.ok) return session.response;

    if (!isBlobConfigured()) {
      return jsonError(
        {
          success: false,
          error:
            'Azure Blob Storage가 설정되지 않았습니다. AZURE_STORAGE_CONNECTION_STRING을 설정해 주세요.',
        },
        503,
      );
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return jsonError({ success: false, error: 'file 필드가 필요합니다.' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > MAX_FILE_BYTES) {
      return jsonError({ success: false, error: '이미지 크기는 8MB 이하여야 합니다.' }, 400);
    }

    const uploaded = await uploadEmployeeJobTrainingPhoto({
      ancd: session.sessionAncd,
      buffer,
      fileName: file.name || 'image.jpg',
      mimeType: file.type || 'image/jpeg',
      size: buffer.length,
    });

    const viewUrl = `/api/f60060/photos?blobName=${encodeURIComponent(uploaded.blobName)}`;

    return jsonOk({
      success: true,
      photo: {
        blobName: uploaded.blobName,
        fileName: uploaded.fileName,
        contentType: uploaded.contentType,
        size: uploaded.size,
        url: viewUrl,
      },
      maxPhotos: MAX_PHOTOS,
    });
  } catch (err) {
    console.error('직원직무교육 사진 업로드 오류:', err);
    return jsonError({ success: false, error: err.message || '사진 업로드 실패' });
  }
}

/** DELETE JSON { blobName } — blob 삭제 */
export async function DELETE(req) {
  try {
    const session = requireSession(req);
    if (!session.ok) return session.response;

    if (!isBlobConfigured()) {
      return jsonError({ success: false, error: 'Azure Blob Storage가 설정되지 않았습니다.' }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const blobName = String(body.blobName || body.blob || '').trim();
    if (!blobName) {
      return jsonError({ success: false, error: 'blobName이 필요합니다.' }, 400);
    }
    if (!assertBlobPathOwnedBySession(blobName, session.sessionAncd)) {
      return jsonError({ success: false, error: '권한이 없거나 잘못된 사진 경로입니다.' }, 403);
    }

    await deleteBlobByName(blobName);
    return jsonOk({ success: true, deleted: blobName });
  } catch (err) {
    console.error('직원직무교육 사진 삭제 오류:', err);
    return jsonError({ success: false, error: err.message || '사진 삭제 실패' });
  }
}
