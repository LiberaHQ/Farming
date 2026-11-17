#!/usr/bin/env node
/**
 * Runs the frontend (Next.js, :3000) and backend (Express, :4000) together,
 * with prefixed output. Ctrl+C stops both. No extra dependencies.
 */
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const services = [
  { name: 'backend ', color: '\x1b[35m', args: ['run', 'dev', '-w', 'backend'] },
  { name: 'frontend', color: '\x1b[36m', args: ['run', 'dev', '-w', 'frontend'] },
];
const reset = '\x1b[0m';
const children = [];
let shuttingDown = false;

function prefix(stream, label) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) process.stdout.write(`${label} ${line}\n`);
  });
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) if (!child.killed) child.kill('SIGINT');
  setTimeout(() => process.exit(code), 500);
}

for (const service of services) {
  const label = `${service.color}[${service.name}]${reset}`;
  const child = spawn(npm, service.args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  prefix(child.stdout, label);
  prefix(child.stderr, label);
  child.on('exit', (code) => {
    process.stdout.write(`${label} exited with code ${code}\n`);
    shutdown(code ?? 1);
  });
  children.push(child);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
