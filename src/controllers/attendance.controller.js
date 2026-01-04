import Attendance from "../models/Attendance.js";
import Subject from "../models/Subject.js";
import User from "../models/user.js";
import mongoose from "mongoose";

export const markAttendance = async (req, res) => {
  try {
    if (req.user.role !== "lecturer") {
      return res.status(403).json({ message: "Only lecturers can mark attendance" });
    }

    const { subjectId, date, records } = req.body;

    if (!subjectId || !date || !records?.length) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    const subject = await Subject.findOne({
      _id: subjectId,
      lecturer: req.user.id,
      institute: req.user.institute,
    });

    if (!subject) {
      return res.status(404).json({ message: "Subject not found or unauthorized" });
    }

    const attendanceDocs = records.map((r) => ({
      subject: subjectId,
      student: r.studentId,
      lecturer: req.user.id,
      institute: req.user.institute,
      date: new Date(date),
      status: r.status,
    }));

    await Attendance.insertMany(attendanceDocs, { ordered: false });

    res.json({ message: "Attendance recorded successfully" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Attendance already marked for this date",
      });
    }

    res.status(500).json({ message: error.message });
  }
};

export const getMyAttendance = async (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Access denied" });
  }

  const attendance = await Attendance.find({
    student: req.user.id,
  })
    .populate("subject", "name code")
    .sort({ date: -1 });

  res.json(attendance);
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
  const { subjectId, date } = req.query;

  const attendance = await Attendance.find({
    subject: subjectId,
    lecturer: req.user.id,
    ...(date && { date: new Date(date) }),
  }).populate("student", "fullName");

  res.json(attendance);
};


export const getMyAttendanceSummary = async (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Access denied" });
  }

  const summary = await Attendance.aggregate([
    {
      $match: {
        student: req.user._id,
      },
    },
    {
      $group: {
        _id: "$subject",
        totalClasses: { $sum: 1 },
        present: {
          $sum: {
            $cond: [{ $eq: ["$status", "present"] }, 1, 0],
          },
        },
        absent: {
          $sum: {
            $cond: [{ $eq: ["$status", "absent"] }, 1, 0],
          },
        },
      },
    },
    {
      $project: {
        totalClasses: 1,
        present: 1,
        absent: 1,
        percentage: {
          $multiply: [
            { $divide: ["$present", "$totalClasses"] },
            100,
          ],
        },
      },
    },
    {
      $lookup: {
        from: "subjects",
        localField: "_id",
        foreignField: "_id",
        as: "subject",
      },
    },
    { $unwind: "$subject" },
    {
      $project: {
        subject: {
          name: "$subject.name",
          code: "$subject.code",
        },
        totalClasses: 1,
        present: 1,
        absent: 1,
        percentage: { $round: ["$percentage", 2] },
      },
    },
  ]);

  res.json(summary);
};


export const checkExamEligibility = async (req, res) => {
  const { subjectId } = req.params;

  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Access denied" });
  }

  const stats = await Attendance.aggregate([
    {
      $match: {
        student: req.user._id,
        subject: subjectId,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        present: {
          $sum: {
            $cond: [{ $eq: ["$status", "present"] }, 1, 0],
          },
        },
      },
    },
  ]);

  if (!stats.length) {
    return res.json({ eligible: false, percentage: 0 });
  }

  const percentage = (stats[0].present / stats[0].total) * 100;

  res.json({
    percentage: Number(percentage.toFixed(2)),
    eligible: percentage >= 75,
  });
};


export const attendanceAnalytics = async (req, res) => {
  const { subjectId } = req.params;

  const data = await Attendance.aggregate([
    {
      $match: {
        subject: subjectId,
        institute: req.user.institute,
      },
    },
    {
      $group: {
        _id: "$date",
        present: {
          $sum: {
            $cond: [{ $eq: ["$status", "present"] }, 1, 0],
          },
        },
        absent: {
          $sum: {
            $cond: [{ $eq: ["$status", "absent"] }, 1, 0],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json(data);
};

