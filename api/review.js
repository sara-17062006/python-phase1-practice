export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured in Vercel.' });
  if (!process.env.OPENAI_MODEL) return res.status(500).json({ error: 'OPENAI_MODEL is not configured in Vercel.' });

  try {
    const body = req.body || {};
    if (!Array.isArray(body.submissions) || ![54, 55].includes(body.submissions.length)) {
      return res.status(400).json({ error: 'Expected 54 core Phase 1 submissions, with an optional 1-problem bonus.' });
    }

    const bonus = body.submissions.filter(s => Number(s.id) === 55);
    const core = body.submissions.filter(s => Number(s.id) !== 55);
    if (core.length !== 54) {
      return res.status(400).json({ error: 'Expected exactly 54 core Phase 1 submissions.' });
    }

    const compact = core.map(s => ({
      id:s.id, topic:s.topic, title:s.title, question:s.question,
      expectedOutput:s.expectedOutput, programInput:s.programInput, actualOutput:s.actualOutput || "",
      code:s.code, completed:!!s.completed
    }));

    const bonusCompact = bonus.map(s => ({
      id:s.id, topic:s.topic, title:s.title, question:s.question,
      expectedOutput:s.expectedOutput, programInput:s.programInput, actualOutput:s.actualOutput || "",
      code:s.code, completed:!!s.completed
    }));

    const instructions = `You are a strict but encouraging Python placement coding mentor.
Create a structured assessment of the student's 54 CORE Phase 1 solutions.

For each core problem:
- classify as exactly one of CORRECT, PARTIALLY CORRECT, INCORRECT, MISSING
- judge the student's ACTUAL submitted code
- explain the mistake in simple beginner-friendly language when not fully correct
- explain the correct logic
- give a concise actionable fix
- mention an edge case when relevant
- do not punish harmless formatting differences such as trailing spaces
- do not claim to have executed code you did not execute

Also produce:
- a score out of 100 using: CORRECT=1, PARTIALLY CORRECT=0.5, INCORRECT/MISSING=0
- topic-wise performance
- recurring/common mistakes
- strengths
- areas to improve
- readiness for Phase 2 Strings
- a separate short review of optional problem 55, without changing the core score

Return ONLY valid JSON. No markdown fences, no commentary.

Exact JSON shape:
{
  "summary": "string",
  "readiness": "READY | NEARLY READY | NOT READY",
  "problems": [
    {
      "id": 1,
      "status": "CORRECT | PARTIALLY CORRECT | INCORRECT | MISSING",
      "summary": "short judgement",
      "why": "why this is correct or what is wrong",
      "correctLogic": "correct reasoning in simple steps",
      "howToFix": "actionable fix",
      "edgeCases": "short edge-case note",
      "correctedCode": "concise corrected Python code or empty string when not needed"
    }
  ],
  "topicPerformance": [
    {"topic":"string","score":0,"max":0,"percent":0}
  ],
  "commonMistakes": [
    {"title":"string","count":1,"description":"string"}
  ],
  "strengths": ["string"],
  "areasToImprove": ["string"],
  "bonus": {
    "id":55,
    "status":"CORRECT | PARTIALLY CORRECT | INCORRECT | MISSING",
    "summary":"string",
    "why":"string",
    "correctLogic":"string",
    "howToFix":"string",
    "correctedCode":"string"
  }
}

Keep each problem review concise enough for a single dashboard card. Ensure exactly 54 core problem objects and preserve their IDs.`;

    const input = `Review these 54 CORE submissions. Optional bonus submission may follow.

CORE:
${JSON.stringify(compact, null, 2)}

BONUS:
${JSON.stringify(bonusCompact, null, 2)}`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`
      },
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL,
        instructions,
        input,
        reasoning:{effort:"low"},
        max_output_tokens:12000
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error:data?.error?.message || 'OpenAI API request failed.'
      });
    }

    const raw = data.output_text || (data.output || [])
      .flatMap(x => x.content || [])
      .filter(x => x.type === 'output_text' && x.text)
      .map(x => x.text).join('\n');

    if (!raw) return res.status(502).json({ error:'The AI returned an empty review.' });

    const extractJson = (text) => {
      const trimmed = String(text).trim();
      const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
      if (fenced) return fenced[1].trim();
      const first = trimmed.indexOf('{');
      const last = trimmed.lastIndexOf('}');
      if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
      return trimmed;
    };

    let review;
    try {
      review = JSON.parse(extractJson(raw));
    } catch (parseError) {
      return res.status(502).json({
        error:'The AI returned an invalid structured review.',
        raw:raw.slice(0, 2500)
      });
    }

    if (!Array.isArray(review.problems) || review.problems.length !== 54) {
      return res.status(502).json({ error:'The AI review did not contain all 54 core problem reviews.' });
    }

    const counts = {CORRECT:0, PARTIALLY_CORRECT:0, INCORRECT:0, MISSING:0};
    for (const p of review.problems) {
      if (counts[p.status] !== undefined) counts[p.status]++;
    }

    const score = Math.round(((counts.CORRECT + 0.5 * counts.PARTIALLY_CORRECT) / 54) * 100);

    return res.status(200).json({
      review: {
        ...review,
        score,
        counts,
        total:54
      },
      reviewedAt:new Date().toISOString()
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error:'Server error while creating the final review.' });
  }
}
