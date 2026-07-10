#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function filesProperty() {
  return {
    type: 'array',
    items: { type: 'string', minLength: 1 },
    uniqueItems: true,
    description: 'Normalized project-relative file references when possible.'
  };
}

function patchExistingSchema(filePath) {
  const schema = readJson(filePath, null);
  if (!schema || typeof schema !== 'object') return;
  schema.properties ||= {};
  schema.properties.files = filesProperty();
  writeJson(filePath, schema);
}

function main() {
  const schemasDir = path.join(kernelHome(), 'source', 'schemas');
  ensureDir(schemasDir);

  for (const name of ['memory.schema.json', 'proposal.schema.json', 'episode.schema.json']) {
    patchExistingSchema(path.join(schemasDir, name));
  }

  const optionalFiles = { files: filesProperty() };
  const schemas = {
    'failure-lesson.schema.json': {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://agent-kernel.local/schemas/failure-lesson.schema.json',
      title: 'Agent Kernel Failure Lesson',
      type: 'object',
      additionalProperties: true,
      required: ['id', 'errorSignature', 'failureType', 'status', 'createdAt'],
      properties: {
        id: { type: 'string' },
        status: { type: 'string' },
        errorSignature: { type: 'string' },
        failureType: { type: 'string' },
        ...optionalFiles,
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      }
    },
    'session-observation.schema.json': {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://agent-kernel.local/schemas/session-observation.schema.json',
      title: 'Agent Kernel Session Observation',
      type: 'object',
      additionalProperties: true,
      required: ['id', 'sessionId', 'type', 'timestamp'],
      properties: {
        id: { type: 'string' },
        sessionId: { type: 'string' },
        type: { type: 'string' },
        timestamp: { type: 'string' },
        ...optionalFiles
      }
    },
    'commit-record.schema.json': {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://agent-kernel.local/schemas/commit-record.schema.json',
      title: 'Agent Kernel Commit Record',
      type: 'object',
      additionalProperties: true,
      required: ['id', 'sha', 'createdAt'],
      properties: {
        id: { type: 'string' },
        sha: { type: 'string' },
        message: { type: 'string' },
        ...optionalFiles,
        createdAt: { type: 'string' }
      }
    }
  };

  for (const [name, schema] of Object.entries(schemas)) writeJson(path.join(schemasDir, name), schema);
}

main();
