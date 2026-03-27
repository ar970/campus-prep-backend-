const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post('/chat', async (req, res) => {
  try {
    const { messages, responseFormat } = req.body;
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.7,
      max_tokens: 1024,
      ...(responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {})
    });
    res.json({ text: completion.choices[0]?.message?.content || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate-questions', async (req, res) => {
  try {
    const { name, role, college, difficulty, qPer, resumeText } = req.body;
    const diffDesc = {
      easy: 'Ask warm, beginner-friendly questions. Be encouraging.',
      medium: 'Ask moderately challenging, professional questions.',
      hard: 'Ask tough, probing questions. Be direct. Always add a follow-up.'
    }[difficulty] || 'Ask professional questions.';

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: `You are a campus recruiter.
Candidate: ${name}, applying for: "${role}", college: ${college || 'India'}.
Difficulty: ${difficulty}. ${diffDesc}
Resume: ${(resumeText || '').substring(0, 2500)}
Generate exactly ${qPer} TECHNICAL questions and ${qPer} HR questions.
TECHNICAL: reference specific resume projects/skills.
HR: include tell me about yourself, strengths, situational. Last HR question must be: "Do you have any questions for us?"
Return ONLY valid JSON: {"tech":["q1","q2"],"hr":["q1","q2"]}` }],
      temperature: 0.8,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });
    const questions = JSON.parse(completion.choices[0]?.message?.content || '{}');
    res.json({ questions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/evaluate-answer', async (req, res) => {
  try {
    const { role, difficulty, round, question, answer } = req.body;
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: `Evaluate this campus interview answer for "${role}". Difficulty: ${difficulty}.
Round: ${round === 'tech' ? 'Technical' : 'HR'}
Question: ${question}
Answer: ${answer}
Return ONLY valid JSON: {"score":<0-100>,"communication":<0-100>,"relevance":<0-100>,"depth":<0-100>,"feedback":"<1 honest sentence>","reaction":"<2-4 word natural reaction>","followUp":"<follow-up question if needed, else empty>"}` }],
      temperature: 0.6,
      max_tokens: 512,
      response_format: { type: 'json_object' }
    });
    const evaluation = JSON.parse(completion.choices[0]?.message?.content || '{}');
    res.json({ evaluation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate-report', async (req, res) => {
  try {
    const { name, role, difficulty, techAvg, hrAvg, faceAvg, overall, techCount, hrCount } = req.body;
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: `Campus interview complete for ${name} applying to ${role}. Difficulty: ${difficulty}.
Technical: ${techAvg}/100 (${techCount} Qs). HR: ${hrAvg}/100 (${hrCount} Qs). Overall: ${overall}/100.
Return ONLY valid JSON: {"verdict":"<Strong Hire|Hire|Borderline|Not Ready>","quote":"<2 sentence assessment>","tech":"<2 sentences>","hr":"<2 sentences>","face":"<1 sentence>","s1":"<action step 1>","s2":"<action step 2>","s3":"<action step 3>"}` }],
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });
    const report = JSON.parse(completion.choices[0]?.message?.content || '{}');
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
