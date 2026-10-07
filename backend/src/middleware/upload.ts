import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('INVALID_FILE_TYPE: Only JPEG and PNG images are allowed'));
    }
  },
});

export const evidenceUpload = upload.single('photo');

export function handleUpload(req: Request, res: Response, next: NextFunction): void {
  evidenceUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'Uploaded photograph exceeds the 5MB maximum limit',
          },
        });
        return;
      }
      res.status(400).json({
        error: {
          code: 'UPLOAD_ERROR',
          message: err.message,
        },
      });
      return;
    } else if (err) {
      res.status(400).json({
        error: {
          code: 'INVALID_FILE',
          message: err.message,
        },
      });
      return;
    }
    next();
  });
}
