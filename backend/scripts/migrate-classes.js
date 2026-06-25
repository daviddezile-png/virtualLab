/**
 * Migration — backfill the new "class" layer.
 * Usage:  node scripts/migrate-classes.js
 *
 * Idempotent: safe to run multiple times.
 *
 * What it does:
 *   1. Gives any pre-existing nameless ClassInvite a default name.
 *   2. For every teacher that has students with no class yet, ensures a single
 *      "Legacy" class exists and enrolls those students into it — so existing
 *      analytics keep working and nobody appears "unassigned".
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose    = require('mongoose');
const User        = require('../models/User');
const ClassInvite = require('../models/ClassInvite');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randToken = () =>
  `CLS-${Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')}`;

async function uniqueToken() {
  for (let i = 0; i < 5; i++) {
    const token = randToken();
    if (!(await ClassInvite.findOne({ token }))) return token;
  }
  return `CLS-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // 1. Name any legacy invites that predate the `name` field.
  const nameless = await ClassInvite.find({
    $or: [{ name: { $exists: false } }, { name: '' }, { name: null }],
  });
  for (const inv of nameless) {
    inv.name = `Class ${new Date(inv.createdAt || Date.now()).getFullYear()}`;
    await inv.save();
  }
  if (nameless.length) console.log(`📝 Named ${nameless.length} legacy class code(s)`);

  // 2. Enroll classless students into a per-teacher legacy class.
  const classless = await User.find({
    role: 'student',
    assignedTeacherId: { $ne: null },
    $or: [{ assignedClassId: { $exists: false } }, { assignedClassId: null }],
  }).select('clientId assignedTeacherId assignedTeacherName');

  // Group classless students by their teacher.
  const byTeacher = new Map();
  for (const s of classless) {
    if (!byTeacher.has(s.assignedTeacherId)) byTeacher.set(s.assignedTeacherId, []);
    byTeacher.get(s.assignedTeacherId).push(s);
  }

  let enrolled = 0;
  for (const [teacherId, students] of byTeacher) {
    const teacherName = students[0].assignedTeacherName || '';

    // Reuse an existing un-archived class for this teacher, else make a Legacy one.
    let cls = await ClassInvite.findOne({ teacherId, archived: { $ne: true } }).sort({ createdAt: 1 });
    if (!cls) {
      cls = await ClassInvite.create({
        token:       await uniqueToken(),
        teacherId,
        teacherName,
        name:        'Legacy class',
        year:        String(new Date().getFullYear()),
      });
      console.log(`➕ Created "Legacy class" (${cls.token}) for teacher ${teacherId}`);
    }

    const ids = students.map(s => s.clientId);
    await User.updateMany(
      { clientId: { $in: ids } },
      { assignedClassId: cls._id.toString(), assignedClassName: cls.name }
    );
    cls.useCount = (cls.useCount || 0) + ids.length;
    await cls.save();
    enrolled += ids.length;
  }

  console.log(`👥 Enrolled ${enrolled} existing student(s) into a class`);
  console.log('✅ Migration complete');
  await mongoose.connection.close();
  process.exit(0);
}

migrate().catch(async (err) => {
  console.error('❌ Migration failed:', err);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});
