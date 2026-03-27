const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('*')
      .order('started_at', { ascending: false });
    if (error) throw error;

    const completed = sessions.filter(s => s.status === 'completed');
    const stats = {
      total: sessions.length,
      completed: completed.length,
      inProgress: sessions.filter(s => s.status === 'in_progress').length,
      avgScore: completed.length ? Math.round(completed.reduce((a, s) => a + (s.overall_score || 0), 0) / completed.length) : 0,
      avgTech: completed.length ? Math.round(completed.reduce((a, s) => a + (s.tech_score || 0), 0) / completed.length) : 0,
      avgHR: completed.length ? Math.round(completed.reduce((a, s) => a + (s.hr_score || 0), 0) / completed.length) : 0,
      verdictBreakdown: {
        'Strong Hire': completed.filter(s => s.verdict === 'Strong Hire').length,
        'Hire': completed.filter(s => s.verdict === 'Hire').length,
        'Borderline': completed.filter(s => s.verdict === 'Borderline').length,
        'Not Ready': completed.filter(s => s.verdict === 'Not Ready').length,
      }
    };
    res.json({ stats, sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/student/:sessionId', adminAuth, async (req, res) => {
  try {
    const id = req.params.sessionId;
    const [{ data: session, error: sErr }, { data: answers, error: aErr }, { data: violations, error: vErr }] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', id).single(),
      supabase.from('answers').select('*').eq('session_id', id).order('q_index'),
      supabase.from('violations').select('*').eq('session_id', id).order('occurred_at')
    ]);
    if (sErr) throw sErr;
    res.json({ session, answers, violations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export', adminAuth, async (req, res) => {
  try {
    const { data: sessions, error } = await supabase
      .from('sessions').select('*').eq('status', 'completed')
      .order('completed_at', { ascending: false });
    if (error) throw error;

    const headers = ['Name','College','Role','Difficulty','Overall','Technical','HR','Verdict','Violations','Date'];
    const rows = sessions.map(s => [
      s.student_name, s.college, s.role, s.difficulty,
      s.overall_score, s.tech_score, s.hr_score,
      s.verdict, s.violations || 0,
      s.completed_at ? new Date(s.completed_at).toLocaleDateString('en-IN') : '—'
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="campusprep-results.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
