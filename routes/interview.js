const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');

router.post('/start', async (req, res) => {
  try {
    const { name, college, role, difficulty, qPer } = req.body;
    const sessionId = uuidv4();
    const { error } = await supabase.from('sessions').insert({
      id: sessionId,
      student_name: name,
      college: college || '',
      role, difficulty,
      q_per_round: qPer || 5,
      status: 'in_progress',
      started_at: new Date().toISOString()
    });
    if (error) throw error;
    res.json({ sessionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/save-answer', async (req, res) => {
  try {
    const { sessionId, round, qIdx, question, answer, score, communication, relevance, depth, feedback } = req.body;
    const { error } = await supabase.from('answers').insert({
      session_id: sessionId,
      round, q_index: qIdx, question, answer,
      score, communication, relevance, depth, feedback,
      answered_at: new Date().toISOString()
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/save-report', async (req, res) => {
  try {
    const { sessionId, overallScore, techScore, hrScore, faceScore,
      verdict, quote, tech, hr, face, s1, s2, s3,
      commAvg, relAvg, depthAvg, violations, totalDuration } = req.body;
    const { error } = await supabase.from('sessions').update({
      status: 'completed',
      overall_score: overallScore, tech_score: techScore,
      hr_score: hrScore, face_score: faceScore,
      comm_avg: commAvg, relevance_avg: relAvg, depth_avg: depthAvg,
      verdict, report_quote: quote, report_tech: tech,
      report_hr: hr, report_face: face,
      action_step_1: s1, action_step_2: s2, action_step_3: s3,
      violations: violations || 0,
      total_duration_secs: totalDuration || 0,
      completed_at: new Date().toISOString()
    }).eq('id', sessionId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/save-violation', async (req, res) => {
  try {
    const { sessionId, reason, timestamp } = req.body;
    const { error } = await supabase.from('violations').insert({
      session_id: sessionId,
      reason,
      occurred_at: timestamp || new Date().toISOString()
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
