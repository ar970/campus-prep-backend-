const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Model is configurable from Render env vars, so the next Groq deprecation
// only needs an env change, not a code change.
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

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
      model: MODEL,
      reasoning_effort: 'low',
      messages,
      temperature: 0.7,
      max_tokens: 2048,
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

    const prompt = `You are a campus recruiter interviewing ${name} for the role of "${role}". College: ${college || 'India'}.
Every question must help you decide one thing: is this candidate ready for THIS role?
Difficulty: ${difficulty}. ${diffDesc}
Resume: ${(resumeText || '').substring(0, 2500)}

First, silently work out the main skills a "${role}" is tested on in real campus interviews. If it is not a coding role (design, marketing, sales, finance, HR, consulting, etc.), "technical" means the core skills of that role, not programming.

Generate exactly ${qPer} TECHNICAL questions and ${qPer} HR questions.

TECHNICAL:
- Each question tests a skill the "${role}" actually needs. Cover different skills.
- Use the resume as evidence: when a project or skill is relevant, ask about it in terms of the role (e.g. "You built X. How would that help you as a ${role}?").
- If the resume shows nothing for a skill the role needs, ask about that skill directly, so the gap shows.
- Never ask about a resume item that has nothing to do with the role.

HR:
- Include: tell me about yourself, why you want to be a ${role}, a strength with an example, and a situation someone in this role would really face.
- Last HR question must be exactly: "Do you have any questions for us?"

Every question must sound like a real interviewer said it: short, clear, one question at a time, answerable out loud in under 2 minutes.
Return ONLY valid JSON: {"tech":["q1","q2"...],"hr":["q1","q2"...]}`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      reasoning_effort: 'low',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 3000,
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
      model: MODEL,
      reasoning_effort: 'low',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // lower temp = more consistent, less random generosity
      max_tokens: 1500,
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
// Body: { name, role, college, difficulty, techAvg, hrAvg, faceAvg, overall,
//         commAvg, relAvg, depthAvg, faceInfo, techCount, hrCount,
//         worstAnswers, bestAnswers, resumeSnippet }
router.post('/generate-report', async (req, res) => {
  try {
    const {
      name, role, college, difficulty,
      techAvg, hrAvg, faceAvg, overall,
      commAvg, relAvg, depthAvg,
      faceInfo, techCount, hrCount,
      worstAnswers, bestAnswers, resumeSnippet
    } = req.body;

    const prompt = `You are a senior campus recruiter writing a final performance report.

CANDIDATE: ${name}
ROLE APPLIED: ${role}
COLLEGE: ${college || 'Not specified'}
DIFFICULTY: ${difficulty}

SCORES:
- Technical: ${techAvg}/100 (${techCount} questions)
- HR: ${hrAvg}/100 (${hrCount} questions)
- Communication: ${commAvg || '—'}/100
- Relevance: ${relAvg || '—'}/100
- Depth: ${depthAvg || '—'}/100
- Face/Presence: ${faceAvg}/100
- Overall: ${overall}/100
${faceInfo || 'No camera data.'}

RESUME BACKGROUND (use this to tailor the action plan to their actual field):
${resumeSnippet || 'Not provided.'}

WEAKEST ANSWERS (where they struggled — use these for specific action steps):
${worstAnswers || 'No weak answers recorded.'}

STRONGEST ANSWERS (what they did well):
${bestAnswers || 'No strong answers recorded.'}

VERDICT RULES:
- "Strong Hire": Overall 80+, Technical 75+, HR 70+
- "Hire": Overall 65+, Technical 60+
- "Borderline": Overall 45-64 OR Technical below 50
- "Not Ready": Overall below 45 OR Technical below 35
- If technical below 40 → verdict CANNOT be Hire or Strong Hire

ACTION PLAN RULES — most important section:
- Each step MUST be specific to this candidate's actual weak answers and their resume/field
- Reference their actual projects, skills, topics, or role by name
- NEVER write generic advice like "practice more" or "revise core concepts"
- BAD: "Practice answering technical questions clearly"
- GOOD: "You struggled to explain your Django project — write a 2-minute verbal pitch of what it does, the tech stack used, and one real challenge you solved. Say it out loud daily until it's fluent."
- GOOD: "Your SQL joins answer was vague — revise INNER, LEFT, RIGHT, and FULL joins with examples from your internship data and practise explaining when you'd use each one."
- Steps must be immediately actionable this week, not vague long-term advice.

Return ONLY valid JSON:
{"verdict":"<Strong Hire|Hire|Borderline|Not Ready>","quote":"<2 sentences direct honest assessment mentioning their specific role and actual performance>","tech":"<2 sentences on technical performance with specific topics they got right or wrong>","hr":"<2 sentences on communication and HR with specifics from their answers>","face":"<1 sentence on body language and confidence>","s1":"<specific action step tied to their weakest answer — name the actual topic or project>","s2":"<specific action step for second biggest gap — a concrete daily task>","s3":"<specific step for third gap OR a strength to reinforce before real interviews>"}`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      reasoning_effort: 'low',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 2500,
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

// ── POST /api/ai/analyze-face ──
// Heuristic face analysis — generates plausible scores based on interview context
// For production, replace with a vision-capable model
router.post('/analyze-face', async (req, res) => {
  try {
    const { question, answer, hasCamera } = req.body;
    if (!hasCamera) return res.json(null);

    // Use Groq to generate contextual face scores based on answer quality
    const completion = await groq.chat.completions.create({
      model: MODEL,
      reasoning_effort: 'low',
      messages: [{ role: 'user', content: `You are analyzing a candidate's body language during a job interview based on their answer quality.
Question: ${question}
Answer: ${answer}

Based on the confidence and clarity of this answer, estimate realistic body language scores.
A strong detailed answer suggests good eye contact and confidence. A vague short answer suggests lower confidence.
Return ONLY valid JSON: {"eyeContact":<0-100>,"confidence":<0-100>,"expression":<0-100>,"overall":<0-100>,"note":"<short 5-word observation>"}` }],
      temperature: 0.4,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });
    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
