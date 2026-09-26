const Anthropic = require('@anthropic-ai/sdk');

let client = null;

function getClient() {
  if (!process.env.LLM_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.LLM_API_KEY });
  return client;
}

module.exports = { getClient };
