const { GoogleGenAI } = require('@google/genai');

let client = null;

function getClient() {
  if (!process.env.LLM_API_KEY) return null;
  if (!client) client = new GoogleGenAI({ apiKey: process.env.LLM_API_KEY });
  return client;
}

module.exports = { getClient };
