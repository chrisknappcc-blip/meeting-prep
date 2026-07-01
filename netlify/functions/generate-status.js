exports.handler = async (event) => {
  const jobId = (event.queryStringParameters || {}).id;
  if (!jobId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing job ID' }) };

  const { getStore } = require('@netlify/blobs');
  const store = getStore('meeting-briefs');

  try {
    const raw = await store.get(jobId, { type: 'text' });
    if (!raw) return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'pending' }) };
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: raw };
  } catch {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'pending' }) };
  }
};
