// ---- Azure Blob Storage (same REST pattern as Cipher's hubspot.js) ----
const AZURE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const AZURE_SAS_TOKEN = process.env.AZURE_STORAGE_SAS_TOKEN;
const AZURE_CONTAINER = process.env.AZURE_STORAGE_CONTAINER || "meeting-briefs";

function blobUrl(blobName) {
  const sas = (AZURE_SAS_TOKEN || "").startsWith("?") ? AZURE_SAS_TOKEN : `?${AZURE_SAS_TOKEN}`;
  return `https://${AZURE_ACCOUNT}.blob.core.windows.net/${AZURE_CONTAINER}/${blobName}${sas}`;
}

exports.handler = async (event) => {
  const jobId = (event.queryStringParameters || {}).id;
  if (!jobId) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing job ID" }) };
  }

  try {
    const res = await fetch(blobUrl(`${jobId}.json`));

    if (res.status === 404) {
      // Blob not written yet — treat as still pending rather than an error
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      };
    }

    if (!res.ok) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      };
    }

    const data = await res.json().catch(() => ({ status: "pending" }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending" }),
    };
  }
};
