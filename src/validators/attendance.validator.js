import { body, param, validationResult } from 'express-validator';

export const markAttendanceRules = [
  body('subjectId').isMongoId().withMessage('Valid subject ID is required'),
  body('date').optional().isISO8601().toDate().withMessage('Invalid date'),
  body('present').isArray().withMessage('present must be an array of student IDs'),
  body('present.*').isMongoId().withMessage('Invalid student ID in present array'),
];

export const subjectIdParam = [param('subjectId').isMongoId().withMessage('Invalid subject ID')];

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};
