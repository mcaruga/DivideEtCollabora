import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = process.env.CLOUDINARY_CLOUD_NAME
  ? new CloudinaryStorage({
      cloudinary,
      params: {
        folder: 'divideetcollabora/receipts',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1200, quality: 'auto' }],
      } as any,
    })
  : multer.diskStorage({
      destination: 'uploads/',
      filename: (_req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
    });

export const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
export { cloudinary };
