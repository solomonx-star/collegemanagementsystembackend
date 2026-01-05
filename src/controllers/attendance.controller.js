import Attendance from "../models/Attendance.js";
import Subject from "../models/Subject.js";
import Class from "../models/Class.js";
import User from "../models/user.js";
import mongoose from "mongoose";

export const markAttendance = async (req, res) => {
  try {
    if (req.user.role !== "lecturer" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins and lecturers can mark attendance" });
    }

    const { subjectId, classId, date, records } = req.body;

    if ((!subjectId && !classId) || !date || !records?.length) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    // Determine class from provided subjectId or classId
    let classRef = classId;

    if (subjectId) {
      const subject = await Subject.findOne({
        _id: subjectId,
        lecturer: req.user.id,
        institute: req.user.institute,
      });

      if (!subject) {
        return res.status(404).json({ message: "Subject not found or unauthorized" });
      }

      classRef = subject.class;
    }

    // if (classId) {
    //   const classDoc = await Class.findOne({
    //     _id: classId,
    //     lecturer: req.user.id,
    //     institute: req.user.institute,
    //   });

    //   if (!classDoc) {
    //     return res.status(404).json({ message: "Class not found or unauthorized" });
    //   }
    // }

    const attendanceDate = new Date(date);

    const existing = await Attendance.findOne({
      class: classRef,
      date: attendanceDate,
      institute: req.user.institute,
    });

    if (existing) {
      return res.status(409).json({ message: "Attendance already marked for this date" });
    }

    const attendanceDoc = await Attendance.create({
      class: classRef,
      institute: req.user.institute,
      date: attendanceDate,
      records: records.map((r) => ({ student: r.studentId, status: r.status })),
      markedBy: req.user.id,
    });

    res.status(201).json({ message: "Attendance recorded successfully", data: attendanceDoc });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyAttendance = async (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Access denied" });
  }

  const attendances = await Attendance.find({ "records.student": req.user.id })
    .populate("class", "name")
    .sort({ date: -1 })
    .lean();

  // Return only the student's record for each attendance entry
  const result = attendances.map((a) => {
    const rec = (a.records || []).find((r) => String(r.student) === String(req.user.id));
    return {
      _id: a._id,
      class: a.class,
      date: a.date,
      status: rec ? rec.status : null,
    };
  });

  res.json(result);
};


export const attendanceSummary = async (req, res) => {
  const { studentId } = req.params;

  const total = await Attendance.countDocuments({
    "records.student": studentId,
  });

  const present = await Attendance.countDocuments({
    records: { $elemMatch: { student: studentId, status: "present" } },
  });

  const percentage = total === 0 ? 0 : ((present / total) * 100).toFixed(2);

  res.json({ total, present, percentage });
};



export const getSubjectAttendance = async (req, res) => {
  // Support both subjectId (legacy) and classId
  const { subjectId, classId, date } = req.query;

  let classRef = classId;

  if (subjectId) {
    const subject = await Subject.findOne({ _id: subjectId, institute: req.user.institute });
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    classRef = subject.class;
  }

  if (!classRef) return res.status(400).json({ message: "classId or subjectId required" });

  const attendance = await Attendance.find({
    class: classRef,
    ...(date && { date: new Date(date) }),
    institute: req.user.institute,
  }).populate("records.student", "fullName");

  res.json(attendance);
};


export const getMyAttendanceSummary = async (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Access denied" });
  }
  const summary = await Attendance.aggregate([
    { $unwind: "$records" },
    { $match: { "records.student": mongoose.Types.ObjectId(req.user._id) } },
    {
      $group: {
        _id: "$class",
        totalClasses: { $sum: 1 },
        present: {
          $sum: { $cond: [{ $eq: ["$records.status", "present"] }, 1, 0] },
        },
        absent: {
          $sum: { $cond: [{ $eq: ["$records.status", "absent"] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        totalClasses: 1,
        present: 1,
        absent: 1,
        percentage: { $cond: [{ $eq: ["$totalClasses", 0] }, 0, { $round: [{ $multiply: [{ $divide: ["$present", "$totalClasses"] }, 100] }, 2] }] },
      },
    },
    {
      $lookup: {
        from: "classes",
        localField: "_id",
        foreignField: "_id",
        as: "class",
      },
    },
    { $unwind: "$class" },
    {
      $project: {
        class: { name: "$class.name" },
        totalClasses: 1,
        present: 1,
        absent: 1,
        percentage: 1,
      },
    },
  ]);

  res.json(summary);
};


export const checkExamEligibility = async (req, res) => {
  // Accept either subjectId (legacy) or classId
  const { subjectId, classId } = req.params;

  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Access denied" });
  }

  let classRef = classId;

  if (subjectId) {
    const subject = await Subject.findOne({ _id: subjectId, institute: req.user.institute });
    if (!subject) return res.json({ eligible: false, percentage: 0 });
    classRef = subject.class;
  }

  if (!classRef) return res.status(400).json({ message: "classId or subjectId required" });

  const stats = await Attendance.aggregate([
    { $unwind: "$records" },
    { $match: { "records.student": mongoose.Types.ObjectId(req.user._id), class: mongoose.Types.ObjectId(classRef) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ["$records.status", "present"] }, 1, 0] } },
      },
    },
  ]);

  if (!stats.length) {
    return res.json({ eligible: false, percentage: 0 });
  }

  const percentage = (stats[0].present / stats[0].total) * 100;

  res.json({ percentage: Number(percentage.toFixed(2)), eligible: percentage >= 75 });
};


export const attendanceAnalytics = async (req, res) => {
  // Accept subjectId (legacy) or classId
  const { subjectId, classId } = req.params;

  let classRef = classId;

  if (subjectId) {
    const subject = await Subject.findOne({ _id: subjectId, institute: req.user.institute });
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    classRef = subject.class;
  }

  if (!classRef) return res.status(400).json({ message: "classId or subjectId required" });

  const data = await Attendance.aggregate([
    { $unwind: "$records" },
    { $match: { class: mongoose.Types.ObjectId(classRef), institute: mongoose.Types.ObjectId(req.user.institute) } },
    {
      $group: {
        _id: "$date",
        present: { $sum: { $cond: [{ $eq: ["$records.status", "present"] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ["$records.status", "absent"] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json(data);
};

