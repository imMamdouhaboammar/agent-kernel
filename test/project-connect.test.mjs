import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import pathLib from 'node:path';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = pathLib.dirname(fileURLToPath(import.meta.url));
const brokerPath = pathLib.join(here, '..', 'bin', 'agent-kernel-project-broker.mjs');

// Dynamically import Project Broker to test functions directly
import {
  resolveProjectRootWithMarkers
} from '../bin/agent-kernel-project-broker.mjs';

export const name = 'project-connect-lifecycle';

export async function run() {
  console.log('Running Project Connection Lifecycle tests...');

  // Setup isolated home and project directories
  const tempBase = pathLib.join(os.tmpdir(), `ak-connect-test-${Date.now()}`);
  let mockHome = pathLib.join(tempBase, 'home');
  let mockProject = pathLib.join(tempBase, 'projects', 'My Awesome Project 🚀'); // contains space & unicode

  fs.mkdirSync(mockHome, { recursive: true });
  fs.mkdirSync(mockProject, { recursive: true });

  mockHome = fs.realpathSync(mockHome);
  mockProject = fs.realpathSync(mockProject);

  // Initialize basic project files
  fs.writeFileSync(pathLib.join(mockProject, 'package.json'), JSON.stringify({
    name: 'my-awesome-project',
    version: '1.0.0',
    scripts: {
      test: 'echo test'
    }
  }, null, 2), 'utf8');

  fs.writeFileSync(pathLib.join(mockProject, '.gitignore'), 'node_modules/\n', 'utf8');

  // Backup and mock environment variables for process isolation
  const origHome = process.env.AGENT_KERNEL_HOME;
  process.env.AGENT_KERNEL_HOME = mockHome;

  try {
    // 1. Resolve Project Root with markers
    const nestedDir = pathLib.join(mockProject, 'src', 'components');
    fs.mkdirSync(nestedDir, { recursive: true });

    const detectedRoot = resolveProjectRootWithMarkers(nestedDir);
    assert.strictEqual(detectedRoot, mockProject, 'Should resolve to the project root containing package.json');
    console.log('✓ Project root detection from nested directory passes.');

    // Helper to spawn the broker process with custom env
    const runBroker = (args, options = {}) => {
      const res = childProcess.spawnSync(process.execPath, [brokerPath, ...args], {
        cwd: mockProject,
        env: { ...process.env, AGENT_KERNEL_HOME: mockHome },
        encoding: 'utf8',
        ...options
      });
      return res;
    };

    // 2. Connect Command: Dry-run validation (No filesystem changes!)
    const dryRunRes = runBroker(['project', 'connect', '--dry-run']);
    assert.strictEqual(dryRunRes.status, 0, 'Dry run should exit with 0');
    assert.ok(!fs.existsSync(pathLib.join(mockProject, '.agent-kernel')), 'Dry-run must not create .agent-kernel dir');
    assert.ok(dryRunRes.stdout.includes('Status: connected'), 'Dry-run output should simulate successful connection');
    console.log('✓ Connect --dry-run passes.');

    const connectRes = runBroker(['project', 'connect']);
    if (connectRes.status !== 0) {
      console.error('broker stdout:', connectRes.stdout);
      console.error('broker stderr:', connectRes.stderr);
    }
    assert.strictEqual(connectRes.status, 0, 'Connect execution should exit with 0');

    // Verify created layout connection files
    const manifestFile = pathLib.join(mockProject, '.agent-kernel', 'project.toml');
    const policyFile = pathLib.join(mockProject, '.agent-kernel', 'policy.toml');
    const readmeFile = pathLib.join(mockProject, '.agent-kernel', 'README.md');

    assert.ok(fs.existsSync(manifestFile), 'Manifest file project.toml must exist');
    assert.ok(fs.existsSync(policyFile), 'Policy file policy.toml must exist');
    assert.ok(fs.existsSync(readmeFile), 'README file README.md must exist');

    // Verify .gitignore updates with managed entries
    const gitignoreContent = fs.readFileSync(pathLib.join(mockProject, '.gitignore'), 'utf8');
    assert.ok(gitignoreContent.includes('# >>> agent-kernel managed entries >>>'), 'Gitignore must contain managed block header');
    assert.ok(gitignoreContent.includes('.agent-kernel/state/'), 'Gitignore must ignore state directory');
    assert.ok(gitignoreContent.includes('# <<< agent-kernel managed entries <<<'), 'Gitignore must contain managed block footer');

    // Verify Agent Instruction Adapters
    const claudeContent = fs.readFileSync(pathLib.join(mockProject, 'CLAUDE.md'), 'utf8');
    assert.ok(claudeContent.includes('<!-- >>> agent-kernel managed instructions >>> -->'), 'CLAUDE.md must contain managed instruction block header');
    assert.ok(claudeContent.includes('This project is connected to Agent Kernel.'), 'CLAUDE.md must contain connection guidance');

    const agentsContent = fs.readFileSync(pathLib.join(mockProject, 'AGENTS.md'), 'utf8');
    assert.ok(agentsContent.includes('This project is connected to Agent Kernel.'), 'AGENTS.md must contain connection guidance');

    // Verify package.json script additions
    const pkgContent = JSON.parse(fs.readFileSync(pathLib.join(mockProject, 'package.json'), 'utf8'));
    assert.strictEqual(pkgContent.scripts['kernel:status'], 'agent-kernel project status');
    assert.strictEqual(pkgContent.scripts['kernel:doctor'], 'agent-kernel project doctor');
    console.log('✓ Connect real execution, files creation, adapters, gitignore and scripts additions pass.');

    // 4. Idempotency validation (Running connect multiple times should not duplicate blocks or registry keys)
    const secondConnectRes = runBroker(['project', 'connect']);
    assert.strictEqual(secondConnectRes.status, 0, 'Second connect must succeed');

    const secondGitignore = fs.readFileSync(pathLib.join(mockProject, '.gitignore'), 'utf8');
    const matches = secondGitignore.match(/# >>> agent-kernel managed entries >>>/g);
    assert.strictEqual(matches.length, 1, 'Managed entries blocks must not be duplicated in .gitignore');

    const secondClaude = fs.readFileSync(pathLib.join(mockProject, 'CLAUDE.md'), 'utf8');
    const claudeMatches = secondClaude.match(/<!-- >>> agent-kernel managed instructions >>> -->/g);
    assert.strictEqual(claudeMatches.length, 1, 'Managed instruction blocks must not be duplicated in CLAUDE.md');
    console.log('✓ Idempotent execution of multiple connects passes.');

    // 5. Connect Command: JSON format output
    const jsonConnectRes = runBroker(['project', 'connect', '--json']);
    assert.strictEqual(jsonConnectRes.status, 0, 'JSON output should succeed');
    const parsedJson = JSON.parse(jsonConnectRes.stdout);
    assert.strictEqual(parsedJson.status, 'connected');
    assert.strictEqual(parsedJson.root, mockProject);
    console.log('✓ Connect --json output format passes.');

    // 6. Direct Aliases (connect / disconnect)
    const statusRes = runBroker(['connect']);
    assert.strictEqual(statusRes.status, 0, 'Direct "connect" command alias must route successfully');
    console.log('✓ Direct command aliases routing passes.');

    // 7. Status Command
    const statusValRes = runBroker(['project', 'status']);
    if (statusValRes.status !== 0) {
      console.error('statusValRes stdout:', statusValRes.stdout);
      console.error('statusValRes stderr:', statusValRes.stderr);
    }
    assert.strictEqual(statusValRes.status, 0);
    assert.ok(statusValRes.stdout.includes('Status: connected'), 'Status output should reflect connected state');

    const statusJsonRes = runBroker(['project', 'status', '--json']);
    assert.strictEqual(statusJsonRes.status, 0);
    const parsedStatusJson = JSON.parse(statusJsonRes.stdout);
    assert.strictEqual(parsedStatusJson.status, 'connected');
    assert.strictEqual(parsedStatusJson.projectId, 'my-awesome-project');
    console.log('✓ Status command passes.');

    // 8. Diagnostics and Doctor Command
    const doctorInitRes = runBroker(['project', 'doctor']);
    assert.strictEqual(doctorInitRes.status, 0);
    assert.ok(doctorInitRes.stdout.includes('All diagnostic checks passed!'));

    // Induce a corrupted adapter block (missing footer)
    fs.writeFileSync(pathLib.join(mockProject, 'CLAUDE.md'), '<!-- >>> agent-kernel managed instructions >>> -->\nsome corrupt stuff...', 'utf8');
    const doctorWarnRes = runBroker(['project', 'doctor']);
    assert.strictEqual(doctorWarnRes.status, 0);
    assert.ok(doctorWarnRes.stdout.includes('CORRUPTED_ADAPTER_BLOCK'), 'Doctor should flag corrupted blocks');

    // Run Doctor with Fix
    const doctorFixRes = runBroker(['project', 'doctor', '--fix']);
    assert.strictEqual(doctorFixRes.status, 0);
    assert.ok(doctorFixRes.stdout.includes('Repairs completed successfully'));

    const cleanClaude = fs.readFileSync(pathLib.join(mockProject, 'CLAUDE.md'), 'utf8');
    assert.ok(cleanClaude.includes('<!-- <<< agent-kernel managed instructions <<< -->'), 'Doctor --fix must restore the footer and repair block integrity');
    console.log('✓ Diagnostics, corruption detection, and automatic doctor fixes pass.');

    // 9. Reconnect Command
    const reconnectRes = runBroker(['project', 'reconnect']);
    assert.strictEqual(reconnectRes.status, 0);
    assert.ok(reconnectRes.stdout.includes('Status: connected'));
    console.log('✓ Reconnect command passes.');

    // 10. Disconnect Command: Conservative default (keeps project manifest directory)
    const disconnectDefaultRes = runBroker(['project', 'disconnect']);
    assert.strictEqual(disconnectDefaultRes.status, 0);
    assert.ok(fs.existsSync(manifestFile), 'Disconnect by default must preserve the committed project manifest');

    // Verify cleanup of managed blocks from files
    const cleanGitignore = fs.readFileSync(pathLib.join(mockProject, '.gitignore'), 'utf8');
    assert.ok(!cleanGitignore.includes('# >>> agent-kernel managed entries >>>'), 'Disconnect must remove gitignore managed entries block');

    assert.ok(!fs.existsSync(pathLib.join(mockProject, 'CLAUDE.md')), 'Empty files created by agent should be cleanly deleted');

    const cleanPkgContent = JSON.parse(fs.readFileSync(pathLib.join(mockProject, 'package.json'), 'utf8'));
    assert.ok(!cleanPkgContent.scripts['kernel:status'], 'Disconnect must clean scripts from package.json');
    console.log('✓ Disconnect conservative cleanup passes.');

    // 11. Disconnect Command with removal option
    // Connect again first
    runBroker(['project', 'connect']);
    assert.ok(fs.existsSync(manifestFile));

    const disconnectRemoveRes = runBroker(['project', 'disconnect', '--remove-manifest']);
    assert.strictEqual(disconnectRemoveRes.status, 0);
    assert.ok(!fs.existsSync(pathLib.join(mockProject, '.agent-kernel')), 'Disconnect --remove-manifest must completely remove local .agent-kernel dir');
    console.log('✓ Disconnect --remove-manifest complete cleanup passes.');

  } finally {
    // Restore original environment
    if (origHome === undefined) {
      delete process.env.AGENT_KERNEL_HOME;
    } else {
      process.env.AGENT_KERNEL_HOME = origHome;
    }

    // Clean up temporary base directory
    try {
      fs.rmSync(tempBase, { recursive: true, force: true });
    } catch {}
  }

  console.log('✓ All connection lifecycle tests passed successfully!');
}
