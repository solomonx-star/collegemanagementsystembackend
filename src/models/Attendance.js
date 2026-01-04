// models/Attendance.js
import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    institute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institute",
      required: true,
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    records: [
      {
        student: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        status: {
          type: String,
          enum: ["present", "absent"],
          default: "present",
        },
      },
    ],
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // lecturer/admin
    },
  },
  { timestamps: true }
);

export default mongoose.model("Attendance", attendanceSchema);
