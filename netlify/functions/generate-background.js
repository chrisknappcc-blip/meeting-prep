const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are a meeting intelligence expert for Care Continuity, makers of CarePathIQ. You produce meeting prep briefs for the sales team before meetings with health system executives.

Care Continuity's core products:
- ED Connect: converts ED and Urgent Care discharges into downstream procedures and service line revenue. Primary proof point: AdventHealth — results validated by their own data sciences team.
- Readmission IQ, Referral/Network IQ, IP Navigation, MOMS.

Target personas: Chief Strategy Officer, VP Patient Access, COO, Service Line Presidents (EM), VP Emergency Services, VP Business Development, VP Care Coordination, CMO, CFO, CIO.

HubSpot signal patterns:
- .scheduled or .currentlyscheduling in email = booked via scheduling link — call this out prominently
- .notinterested = clicked not interested — flag as potential blocker
- REPLIED_30D = hot, REPLIED_90D = warm
- Multiple seniors replying in same week = internal discussion happening

Brief structure — 7 sections:
1. Company Snapshot: key facts table
2. Who You Are Meeting: profile per contact with table + paragraph
3. Account Activity: CRM contact table + narrative
4. Leadership Context: recent changes, new hires
5. Strategic Context: what they're building — ED/access, AI, expansion, financial
6. Meeting Angles: 4-6 specific actionable talking points tied to these contacts' roles
7. Things to Watch: flags, risks, blockers

Writing style: Human, direct, no em dashes, no hyphens as connectors, no corporate filler, specific not generic.

Return ONLY valid JSON with this exact structure:
{
  "company": "string",
  "location": "string",
  "contacts_meeting": ["Name — Title"],
  "campaign": "string",
  "date": "string",
  "account_owner": "string",
  "sections": [
    {"id":"snapshot","heading":"Company Snapshot","type":"table","rows":[{"label":"string","value":"string"}]},
    {"id":"contacts","heading":"Who You Are Meeting","type":"profiles","profiles":[{"name":"string","subtitle":"string","table":[{"label":"string","value":"string"}],"body":"string"}]},
    {"id":"crm","heading":"Account Activity","type":"crm","narrative":"string","contacts":[{"name":"string","title":"string","status":"string","notes":"string"}]},
    {"id":"leadership","heading":"Leadership Context","type":"bullets_grouped","groups":[{"heading":null,"bullets":["string"]}]},
    {"id":"strategic","heading":"Strategic Context","type":"bullets_grouped","groups":[{"heading":"string","bullets":["string"]}]},
    {"id":"angles","heading":"Meeting Angles","type":"angles","items":[{"heading":"string","body":"string"}]},
    {"id":"watch","heading":"Things to Watch","type":"bullets","bullets":["string"]}
  ]
}`;

exports.handler = async (event) => {
  let payload;
  try { payload = JSON.parse(event.body); } catch { return { statusCode: 400 }; }

  const { jobId, company, allContacts, selectedContacts, customContacts, campaign, notes, accountOwner } = payload;

  const { getStore } = require('@netlify/blobs');
  const store = getStore('meeting-briefs');

  // Mark as in-progress
  await store.set(jobId, JSON.stringify({ status: 'pending' }));

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const selectedList = (selectedContacts || []).map(c =>
    `${c.name} (${c.title || 'N/A'}) | email: ${c.email || 'N/A'} | ${c.notes} notes | ${c.sequences} seq | last reply: ${c.lastReply || 'none'} | signals: ${(c.signals||[]).join(', ') || 'none'}`
  ).join('\n');

  const customList = (customContacts || []).map(c =>
    `${c.name} (${c.title || 'N/A'}) — manually added, not yet in HubSpot`
  ).join('\n');

  const allContactsTable = (allContacts || []).slice(0, 50).map(c => {
    const sig = c.signals && c.signals.length ? ` [${c.signals.join('|')}]` : '';
    return `- ${c.name} | ${c.title || 'N/A'} | ${c.notes} notes | ${c.sequences} seq | reply: ${c.lastReply || 'none'}${sig}`;
  }).join('\n');

  const userPrompt = `Generate a meeting prep brief for this upcoming meeting.

COMPANY: ${company.name}
LOCATION: ${company.city || ''}, ${company.state || ''}
ACCOUNT OWNER: ${accountOwner || 'Unknown'}
HUBSPOT: ${company.notes} total contacted notes
TODAY: ${today}

CAMPAIGN: ${campaign || 'Not specified'}
REP NOTES: ${notes || 'None'}

CONTACTS IN THIS MEETING:
${selectedList}
${customList ? `\nCUSTOM CONTACTS:\n${customList}` : ''}

FULL CRM CONTACT LIST:
${allContactsTable}

Use your knowledge of ${company.name} for Leadership and Strategic Context. Return only JSON.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 6000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      await store.set(jobId, JSON.stringify({ status: 'error', error: `Anthropic error: ${data.error?.message || res.status}` }));
      return { statusCode: 200 };
    }

    const textBlock = data.content?.find(b => b.type === 'text');
    if (!textBlock) {
      await store.set(jobId, JSON.stringify({ status: 'error', error: 'No text in Anthropic response' }));
      return { statusCode: 200 };
    }

    const raw = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let brief;
    try {
      brief = JSON.parse(raw);
    } catch {
      const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
      if (s !== -1 && e !== -1) {
        try { brief = JSON.parse(raw.slice(s, e + 1)); }
        catch { await store.set(jobId, JSON.stringify({ status: 'error', error: 'Malformed JSON from model', raw: raw.slice(0, 200) })); return { statusCode: 200 }; }
      } else {
        await store.set(jobId, JSON.stringify({ status: 'error', error: 'Model did not return JSON', raw: raw.slice(0, 200) }));
        return { statusCode: 200 };
      }
    }

    await store.set(jobId, JSON.stringify({ status: 'done', brief }));
  } catch (err) {
    await store.set(jobId, JSON.stringify({ status: 'error', error: err.message }));
  }

  return { statusCode: 200 };
};
