const { pool } = require('./database');

async function getStaffShifts(filters = {}) {
  let query = `
    SELECT ss.*, s.name as staff_name FROM staff_shifts ss
    JOIN staff s ON ss.staff_id = s.id WHERE 1=1
  `;
  const params = [];
  let idx = 1;
  if (filters.staffId) { query += ` AND ss.staff_id = $${idx}`; params.push(filters.staffId); idx++; }
  if (filters.from) { query += ` AND ss.shift_date >= $${idx}`; params.push(filters.from); idx++; }
  if (filters.to) { query += ` AND ss.shift_date <= $${idx}`; params.push(filters.to); idx++; }
  query += ' ORDER BY ss.shift_date, ss.start_time';
  const res = await pool.query(query, params);
  return res.rows;
}

async function createStaffShift({ staffId, shiftDate, startTime, endTime, breakMinutes, notes }) {
  const res = await pool.query(
    `INSERT INTO staff_shifts (staff_id, shift_date, start_time, end_time, break_minutes, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (staff_id, shift_date) DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
     break_minutes = EXCLUDED.break_minutes, notes = EXCLUDED.notes
     RETURNING *`,
    [staffId, shiftDate, startTime, endTime, breakMinutes ?? 0, notes || null]
  );
  return res.rows[0];
}

async function deleteStaffShift(id) {
  await pool.query('DELETE FROM staff_shifts WHERE id = $1', [id]);
}

async function getStaffAttendance(filters = {}) {
  let query = `
    SELECT sa.*, s.name as staff_name FROM staff_attendance sa
    JOIN staff s ON sa.staff_id = s.id WHERE 1=1
  `;
  const params = [];
  let idx = 1;
  if (filters.staffId) { query += ` AND sa.staff_id = $${idx}`; params.push(filters.staffId); idx++; }
  if (filters.from) { query += ` AND sa.attendance_date >= $${idx}`; params.push(filters.from); idx++; }
  if (filters.to) { query += ` AND sa.attendance_date <= $${idx}`; params.push(filters.to); idx++; }
  query += ' ORDER BY sa.attendance_date DESC';
  const res = await pool.query(query, params);
  return res.rows;
}

async function upsertStaffAttendance({ staffId, attendanceDate, checkIn, checkOut, status, notes }) {
  const res = await pool.query(
    `INSERT INTO staff_attendance (staff_id, attendance_date, check_in, check_out, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (staff_id, attendance_date) DO UPDATE SET
     check_in = COALESCE(EXCLUDED.check_in, staff_attendance.check_in),
     check_out = COALESCE(EXCLUDED.check_out, staff_attendance.check_out),
     status = COALESCE(EXCLUDED.status, staff_attendance.status),
     notes = COALESCE(EXCLUDED.notes, staff_attendance.notes),
     updated_at = NOW()
     RETURNING *`,
    [staffId, attendanceDate, checkIn || null, checkOut || null, status || 'present', notes || null]
  );
  return res.rows[0];
}

async function getStaffGoals(staffId = null) {
  let query = `
    SELECT sg.*, s.name as staff_name FROM staff_goals sg
    JOIN staff s ON sg.staff_id = s.id WHERE 1=1
  `;
  const params = [];
  if (staffId) { query += ' AND sg.staff_id = $1'; params.push(staffId); }
  query += ' ORDER BY sg.staff_id, sg.period_value DESC';
  const res = await pool.query(query, params);
  return res.rows;
}

async function upsertStaffGoal({ staffId, periodType, periodValue, targetAmount, targetCount }) {
  const res = await pool.query(
    `INSERT INTO staff_goals (staff_id, period_type, period_value, target_amount, target_count)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (staff_id, period_type, period_value) DO UPDATE SET
     target_amount = EXCLUDED.target_amount,
     target_count = EXCLUDED.target_count
     RETURNING *`,
    [staffId, periodType || 'monthly', periodValue, targetAmount ?? 0, targetCount ?? 0]
  );
  return res.rows[0];
}

module.exports = {
  getStaffShifts,
  createStaffShift,
  deleteStaffShift,
  getStaffAttendance,
  upsertStaffAttendance,
  getStaffGoals,
  upsertStaffGoal,
};
