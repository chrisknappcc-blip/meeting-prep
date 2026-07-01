const TOKEN = process.env.HUBSPOT_PRIVATE_TOKEN;

exports.handler = async (event) => {
  const q = (event.queryStringParameters || {}).q || '';
  if (!q || q.length < 2) return { statusCode: 400, body: JSON.stringify({ error: 'Query too short' }) };

  const res = await fetch('https://api.hubapi.com/crm/v3/objects/companies/search', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: q,
      limit: 8,
      properties: ['name', 'city', 'state', 'domain', 'num_contacted_notes', 'hubspot_owner_id', 'hs_last_sales_activity_timestamp'],
      sorts: [{ propertyName: 'num_contacted_notes', direction: 'DESCENDING' }],
    }),
  });

  const data = await res.json();
  const OWNERS = { '76104455': 'Matt Valin', '55217954': 'Joe Haine', '83862037': 'Tim Grisham', '78304576': 'Chris Knapp', '87806380': 'Chiara Pate' };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify((data.results || []).map(c => ({
      id: c.id,
      name: c.properties.name,
      city: c.properties.city || '',
      state: c.properties.state || '',
      domain: c.properties.domain || '',
      notes: parseInt(c.properties.num_contacted_notes || 0),
      owner: OWNERS[c.properties.hubspot_owner_id] || '',
      lastActivity: c.properties.hs_last_sales_activity_timestamp || '',
    }))),
  };
};
