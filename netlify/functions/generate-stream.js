// Netlify v2 function — export default syntax enables streaming support
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

Brief structure — 9 sections + Sources:
1. Company Snapshot: key facts table
2. Who You Are Meeting: profile per contact with table + paragraph
3. Account Activity: CRM contact table + narrative
4. Leadership Context: recent changes, new hires
5. Strategic Context: ED/access, AI, expansion, financial
6. System-Wide Initiatives: enterprise-level priorities the organization is actively pursuing — value-based care transformation, merger/acquisition integration, workforce programs, consumer access strategy, network expansion, academic or research programs, population health. These are the big bets the C-suite is making right now, not just what their ED is doing.
7. Technology & EHR Profile: which EHR platform they run (Epic, Oracle Health/Cerner, Meditech, etc.), how long they have been on it, known modules or features in use, major tech implementations or migrations underway, AI and digital health initiatives, known vendor partnerships. Critically — assess their historical posture toward external point solutions: are they an Epic App Orchard-first shop, do they prefer best-of-breed, have they adopted outside tools before, or do they tend to consolidate onto a single platform? This directly affects how CarePathIQ gets evaluated.
8. Meeting Angles: 4-6 specific actionable talking points tied to these contacts' roles
9. Things to Watch: flags, risks, blockers

Web research — run these searches before writing:
1. "[Company name] 2025 2026 strategic plan expansion news" — what they're building
2. "[Company name] emergency department OR patient access OR ED Connect 2025 2026" — direct relevance
3. "[Company name] CEO leadership OR CFO OR CSO news 2025 2026" — leadership context
4. "[Company name] Epic OR EHR OR technology OR AI 2025 2026" — tech posture
5. Any searches specific to the contacts' titles or the campaign context

Be selective — only include information that is recent (within 18 months), specific to this organization, and relevant to why CarePathIQ matters to these people. Do not pad with generic industry observations.

Collect every URL you searched or read. Cite them in the Sources section at the end of the brief.

Writing style: Human, direct, no em dashes, no hyphens as connectors, no corporate filler, specific not generic.

Return ONLY valid JSON:
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
    {"id":"initiatives","heading":"System-Wide Initiatives","type":"bullets_grouped","groups":[{"heading":"string","bullets":["string"]}]},
    {"id":"technology","heading":"Technology & EHR Profile","type":"bullets_grouped","groups":[{"heading":"string or null","bullets":["string"]}]},
    {"id":"angles","heading":"Meeting Angles","type":"angles","items":[{"heading":"string","body":"string"}]},
    {"id":"watch","heading":"Things to Watch","type":"bullets","bullets":["string"]},
    {"id":"recommended","heading":"Recommended Contacts","type":"recommended","note":"RESEARCH BRIEF ONLY — omit for meeting prep","contacts":[{"name":"string (real name OR role title if name unknown)","title":"string","isNamed":true,"priority":"string (1-Primary, 2-Secondary, 3-Supporting)","why":"string (why this person for this specific campaign)","findVia":"string (LinkedIn title search, conference, referral from X, etc.)"}]},
    {"id":"sources","heading":"Sources & References","type":"sources","sources":[{"title":"string (page or article title)","url":"string (full URL)","category":"string (e.g. Press Release, News, Company Website, LinkedIn, Annual Report, Health System Profile)","note":"string (brief note on what this source contributed)"}]}
  ]
}`;

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload;
  try { payload = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 }); }

  const { company, allContacts, selectedContacts, customContacts, campaign, notes, accountOwner, isResearch } = payload;

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const selectedList = (selectedContacts || []).map(c =>
    `${c.name} (${c.title || 'N/A'}) | email: ${c.email || 'N/A'} | ${c.notes} notes | ${c.sequences} seq | last reply: ${c.lastReply || 'none'} | signals: ${(c.signals||[]).join(', ') || 'none'}`
  ).join('\n');

  const customList = (customContacts || []).map(c =>
    `${c.name} (${c.title || 'N/A'}) — manually added`
  ).join('\n');

  const allContactsTable = (allContacts || []).slice(0, 50).map(c => {
    const sig = c.signals && c.signals.length ? ` [${c.signals.join('|')}]` : '';
    return `- ${c.name} | ${c.title || 'N/A'} | ${c.notes} notes | ${c.sequences} seq | reply: ${c.lastReply || 'none'}${sig}`;
  }).join('\n');

  const userPrompt = `Generate a ${isResearch ? 'company intelligence research brief' : 'meeting prep brief'}.

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

Use your knowledge of ${company.name} for Leadership and Strategic Context.${isResearch ? `

This is a RESEARCH BRIEF, not a meeting prep. No contacts are specified.
- Skip or minimize the "Who You Are Meeting" section (use a placeholder)
- Skip the "Account Activity" section (no CRM data)
- Expand "Leadership Context" and "Strategic Context" with more depth
- Rename "Meeting Angles" to "Strategic Intelligence" and make it org-level insights: key priorities, market position, likely pain points, how CarePathIQ maps to their world
- Expand "System-Wide Initiatives" with full depth — this is especially valuable in research mode when you don't have a specific meeting context
- Expand "Technology & EHR Profile" with full depth — go deep on EHR history, migration status, digital health posture, and vendor relationships
- "Things to Watch" should cover org dynamics, merger implications, competitive context
- Add a "Recommended Contacts" section (id: "recommended") as the LAST section. For each recommended person:
  * If you know actual named individuals at this org from your training data, name them with their title
  * If not, recommend the right PERSONAS (role title + why this role for this campaign)
  * Always explain WHY each person matters for the specific campaign angle
  * Include 4-6 recommended contacts/personas sorted by priority` : ''}

Return only JSON.`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)); } catch {}
      };

      // Heartbeat every 5 seconds keeps the gateway alive
      const heartbeat = setInterval(() => send({ type: 'ping' }), 5000);

      try {
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 110000); // 110s hard limit
        let res;
        try {
          res = await fetch('https://api.anthropic.com/v1/messages', {
            signal: controller.signal,
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

        clearInterval(heartbeat);

        } finally {
          clearTimeout(fetchTimeout);
        }

        if (!res.ok) {
          const err = await res.text();
          send({ type: 'error', error: `Anthropic ${res.status}: ${err.slice(0, 200)}` });
          controller.close();
          return;
        }

        const data = await res.json();
        const textBlock = data.content?.find(b => b.type === 'text');
        if (!textBlock) { send({ type: 'error', error: 'No text in Anthropic response' }); controller.close(); return; }

        const raw = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        let brief;
        try {
          brief = JSON.parse(raw);
        } catch {
          const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
          if (s !== -1 && e !== -1) {
            try { brief = JSON.parse(raw.slice(s, e + 1)); }
            catch { send({ type: 'error', error: 'Malformed JSON from model' }); controller.close(); return; }
          } else {
            send({ type: 'error', error: 'Model did not return JSON' }); controller.close(); return;
          }
        }

        send({ type: 'done', brief });
      } catch (err) {
        clearInterval(heartbeat);
        send({ type: 'error', error: err.message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
};
