const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── POST /api/ai/chat ──
// Body: { messages: [...], responseFormat: 'json' | 'text' }
// All Gemini calls from the frontend now come here instead
router.post('/chat', async (req, res) => {
  try {
    const { messages, responseFormat } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.7,
      max_tokens: 1024,
      ...(responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {})
    });

    const text = completion.choices[0]?.message?.content || '';
    res.json({ text });

  } catch (err) {
    console.error('Groq error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/generate-questions ──
// Body: { name, role, college, difficulty, qPer, resumeText }
router.post('/generate-questions', async (req, res) => {
  try {
    const { name, role, college, difficulty, qPer, resumeText } = req.body;

    const diffDesc = {
      easy: 'Ask warm, beginner-friendly questions. Be encouraging.',
      medium: 'Ask moderately challenging, professional questions.',
      hard: 'Ask tough, probing questions. Be direct. Always add a follow-up.'
    }[difficulty] || 'Ask professional questions.';

    const prompt = `You are a campus recruiter.
Candidate: ${name}, applying for: "${role}", college: ${college || 'India'}.
Difficulty: ${difficulty}. ${diffDesc}
Resume: ${(resumeText || '').substring(0, 2500)}

Generate exactly ${qPer} TECHNICAL questions and ${qPer} HR questions.
TECHNICAL: reference specific resume projects/skills. Be role-specific.
HR: include tell me about yourself, strengths, situational. Last HR question must be: "Do you have any questions for us?"
Return ONLY valid JSON: {"tech":["q1","q2"...],"hr":["q1","q2"...]}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const text = completion.choices[0]?.message?.content || '{}';
    const questions = JSON.parse(text);
    res.json({ questions });

  } catch (err) {
    console.error('generate-questions error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/evaluate-answer ──
// Body: { role, difficulty, round, question, answer }
router.post('/evaluate-answer', async (req, res) => {
  try {
    const { role, difficulty, round, question, answer } = req.body;

    const scoringRules = `
STRICT SCORING RULES — apply these exactly:
- Score 0-30: Blank, "I don't know", completely off-topic, or just 1-2 generic sentences with zero substance
- Score 31-44: Attempts the question but extremely vague, no examples, no structure whatsoever
- Score 45-59: Partial answer — addresses the question but misses key points or lacks any depth
- Score 60-69: Decent answer — on-topic and reasonable but lacks specific examples or detail
- Score 70-79: Good answer — clear, structured, addresses the question with at least one real example
- Score 80-89: Strong — specific examples with outcomes, good structure, demonstrates real knowledge
- Score 90-100: Exceptional — very specific, mentions numbers/results, excellent articulation and depth

MANDATORY RULES:
1. Do NOT give scores above 60 just because the candidate tried or seemed confident
2. Do NOT give scores above 70 unless the answer has specific examples or real technical detail
3. A vague 2-4 sentence answer with no specifics scores 30-45, NOT 60+
4. "I would do X and Y" with no real examples = maximum 45
5. Answer that doesn't directly address the question = maximum 40
6. Answers under 30 words = maximum 35
7. You are a real campus recruiter. Most candidates score 40-65. Only truly impressive answers score 70+.`;

    const prompt = `You are a strict senior campus recruiter evaluating a candidate for "${role}".
${scoringRules}

Difficulty level: ${difficulty}
Round: ${round === 'tech' ? 'Technical' : 'HR'}
Question asked: ${question}
Candidate answer: ${answer}

Score strictly based on the rules above. Be direct and honest in feedback.
Return ONLY valid JSON:
{"score":<0-100>,"communication":<0-100>,"relevance":<0-100>,"depth":<0-100>,"feedback":"<1 blunt honest sentence about what was weak or strong>","reaction":"<2-4 word natural interviewer reaction>","followUp":"<a probing follow-up question if the answer was vague or incomplete, else empty string>"}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // lower temp = more consistent, less random generosity
      max_tokens: 512,
      response_format: { type: 'json_object' }
    });

    const text = completion.choices[0]?.message?.content || '{}';
    const evaluation = JSON.parse(text);
    res.json({ evaluation });

  } catch (err) {
    console.error('evaluate-answer error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/generate-report ──
// Body: { name, role, difficulty, techAvg, hrAvg, faceAvg, overall, faceInfo, transcript }
router.post('/generate-report', async (req, res) => {
  try {
    const { name, role, difficulty, techAvg, hrAvg, faceAvg, overall, faceInfo, techCount, hrCount } = req.body;

    const prompt = `Campus interview complete for ${name} applying to ${role}. Difficulty: ${difficulty}.
Technical: ${techAvg}/100 (${techCount} Qs). HR: ${hrAvg}/100 (${hrCount} Qs). Face: ${faceAvg}/100. Overall: ${overall}/100.
${faceInfo || 'No camera data.'}
Return ONLY valid JSON:
{"verdict":"<Strong Hire|Hire|Borderline|Not Ready>","quote":"<2 sentence editorial-style overall assessment>","tech":"<2 sentences on technical performance>","hr":"<2 sentences on HR performance>","face":"<1 sentence on body language/presence>","s1":"<specific action step 1>","s2":"<specific action step 2>","s3":"<specific action step 3>"}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    const text = completion.choices[0]?.message?.content || '{}';
    const report = JSON.parse(text);
    res.json({ report });

  } catch (err) {
    console.error('generate-report error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
