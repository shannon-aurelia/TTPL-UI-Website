#!/usr/bin/env node
// Generates MCP payloads for add_code_connect_map from `figma-code-mapping.json`.
// Usage: node scripts/generate_mcp_payloads.js

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const mappingFile = path.join(repoRoot, 'figma-code-mapping.json');
const outDir = path.join(repoRoot, 'out');
if(!fs.existsSync(mappingFile)){
  console.error('Mapping file not found:', mappingFile);
  process.exit(1);
}

const mapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
if(!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const requests = mapping.mappings.map(m => ({
  fileKey: mapping.fileKey,
  nodeId: null, // Optional: if you know the component node id in Figma, add it here
  source: m.sourcePath,
  componentName: m.componentName,
  label: 'Code Connect: ' + m.componentName,
  framework: 'React'
}));

const outPath = path.join(outDir, 'mcp_payloads.json');
fs.writeFileSync(outPath, JSON.stringify({namespace: mapping.namespace, requests}, null, 2));

console.log('MCP payloads written to', outPath);
console.log('\nNext steps:');
console.log('- If you have MCP access, call the MCP tool `add_code_connect_map` for each request or use the MCP CLI.');
console.log('- If you prefer, open `out/mcp_payloads.json` and send it to me and I can apply the mappings when your Figma plan permits.');
