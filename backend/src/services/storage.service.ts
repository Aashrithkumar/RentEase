import { cloudinary } from '../config/cloudinary.js';
import { ApiError } from '../utils/http.js';
export async function uploadBuffer(buffer: Buffer, options: Record<string, unknown>): Promise<{
    secure_url: string;
    public_id: string;
}> {
    if (!process.env.CLOUDINARY_API_SECRET)
        throw new ApiError(503, 'Image and document storage needs Cloudinary configuration.');
    return new Promise((resolve, reject) => { const stream = cloudinary.uploader.upload_stream(options, (err, result) => { if (err || !result)
        reject(new ApiError(502, 'Upload failed. Please try again.'));
    else
        resolve(result); }); stream.end(buffer); });
}
