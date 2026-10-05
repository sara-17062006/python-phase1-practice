export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured in Vercel.' });
  if (!process.env.OPENAI_MODEL) return res.status(500).json({ error: 'OPENAI_MODEL is not configured in Vercel.' });

  try {
    const body = req.body || {};
    if (!Array.isArray(body.submissions) || body.submissions.length !== 54) {
      return res.status(400).json({ error: 'Expected all 54 Phase 1 submissions.' });
    }

    const compact = body.submissions.map(s => ({
      id:s.id, topic:s.topic, title:s.title, question:s.question,
      expectedOutput:s.expectedOutput, programInput:s.programInput,
      code:s.code, completed:!!s.completed
    }));

    const instructions = `You are a strict but encouraging Python placement coding mentor. Review all 54 submitted beginner Python solutions as one Phase 1 assessment. Judge the student's ACTUAL code. For every problem classify it as CORRECT, PARTIALLY CORRECT, INCORRECT, or MISSING. Explain exact mistakes in simple language. Check input handling, operator precedence, conditions, loops, functions, built-ins, recursion and edge cases. Do not punish harmless formatting differences. Finish with score /100, topic-wise performance, recurring mistakes, concepts to relearn, and readiness for Phase 2 Strings. Do not invent test results. Teach reasoning, not memorization.`;
    const input = `Review ALL 54 problems. Student submission:\n\n${JSON.stringify(compact, null, 2)}`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`
      },
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL,
        instructions,
        input
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({
      error:data?.error?.message || 'OpenAI API request failed.'
    });

    const text = data.output_text || (data.output || [])
      .flatMap(x => x.content || [])
      .filter(x => x.type === 'output_text' && x.text)
      .map(x => x.text).join('\n');

    if (!text) return res.status(502).json({ error:'The AI returned an empty review.' });
    return res.status(200).json({ review:text, reviewedAt:new Date().toISOString() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error:'Server error while creating the final review.' });
  }
}
