import express from "express";
import {
  markAttendance,
  getMyAttendance,
  getSubjectAttendance,
  getMyAttendanceSummary,
  checkExamEligibility,
  attendanceAnalytics,
} from "../controllers/attendance.controller.js";
import auth from "../middlewares/auth.js";
import { markAttendanceRules, subjectIdParam, validate } from "../validators/attendance.validator.js";

const router = express.Router();

router.post("/mark-attendance", auth, markAttendance);
router.get("/get-attendance", auth, getMyAttendance);
router.get("/eligibility/:subjectId", auth, subjectIdParam, validate, checkExamEligibility);
router.get("/analytics/subject/:subjectId", auth, subjectIdParam, validate, attendanceAnalytics);
router.get("/subject", auth, getSubjectAttendance);
router.get("/summary/me", auth, getMyAttendanceSummary);
router.get("/summary/subject/:subjectId", auth, subjectIdParam, validate, attendanceAnalytics);

export default router;
