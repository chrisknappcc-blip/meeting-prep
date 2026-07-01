const TOKEN = process.env.HUBSPOT_PRIVATE_TOKEN;
const OWNERS = { '76104455': 'Matt Valin', '55217954': 'Joe Haine', '83862037': 'Tim Grisham', '78304576': 'Chris Knapp', '87806380': 'Chiara Pate' };

exports.handler = async (event) => {
  const companyId = (event.queryStringParameters || {}).id;
  if (!companyId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing company ID' }) };

  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'associatedcompanyid', operator: 'EQ', value: companyId }] }],
      limit: 100,
      properties: [
        'firstname', 'lastname', 'jobtitle', 'email',
        'num_contacted_notes', 'hs_sequences_enrolled_count',
        'hs_sales_email_last_replied', 'hs_last_sales_activity_timestamp',
        'hubspot_owner_id',
      ],
      sorts: [{ propertyName: 'hs_last_sales_activity_timestamp', direction: 'DESCENDING' }],
    }),
  });

  const data = await res.json();

  const contacts = (data.results || []).map(c => {
    const email = c.properties.email || '';
    const signals = [];
    if (email.includes('.scheduled') || email.includes('.currentlyscheduling')) signals.push('BOOKED_MEETING');
    if (email.includes('.notinterested')) signals.push('NOT_INTERESTED');
    if (email.includes('.nolongerthere')) signals.push('LEFT_ORG');

    const lastReply = c.properties.hs_sales_email_last_replied;
    const lastActivity = c.properties.hs_last_sales_activity_timestamp;
    const now = Date.now();
    const replyAge = lastReply ? Math.round((now - new Date(lastReply)) / 86400000) : null;
    const activityAge = lastActivity ? Math.round((now - new Date(lastActivity)) / 86400000) : null;

    if (replyAge !== null && replyAge <= 30) signals.push('REPLIED_30D');
    else if (replyAge !== null && replyAge <= 90) signals.push('REPLIED_90D');

    return {
      id: c.id,
      name: `${c.properties.firstname || ''} ${c.properties.lastname || ''}`.trim(),
      title: c.properties.jobtitle || '',
      email,
      notes: parseInt(c.properties.num_contacted_notes || 0),
      sequences: parseInt(c.properties.hs_sequences_enrolled_count || 0),
      lastReply: lastReply ? lastReply.slice(0, 10) : null,
      lastActivity: lastActivity ? lastActivity.slice(0, 10) : null,
      replyAgeDays: replyAge,
      activityAgeDays: activityAge,
      owner: OWNERS[c.properties.hubspot_owner_id] || '',
      signals,
    };
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contacts, total: data.total }),
  };
};
