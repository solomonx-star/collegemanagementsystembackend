import User from '../models/user.js';

// Placeholder for lecturer controller
export const getLecturerDashboard = (req, res) => {
  res.json({ message: 'Lecturer dashboard not yet implemented' });
};

export const getLecturers = async (req, res) => {
  try {
    const lecturers = await User.find({ role: 'lecturer' }).populate(
      'institute',
      'name'
    );
    res.json(lecturers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getLecturerById = async (req, res) => {
  try {
    const lecturer = await User.findById(req.params.id).populate(
      'institute',
      'name'
    );
    if (!lecturer || lecturer.role !== 'lecturer') {
      return res.status(404).json({ message: 'Lecturer not found' });
    }
    res.json(lecturer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
