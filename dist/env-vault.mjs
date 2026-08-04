export {
  canonicalizeRemote,
  calculateProjectFingerprint,
  calculateProjectIdentity,
  gitRemoteUrl,
  initialCommitHash,
  resolveProjectRoot
} from './env-vault/identity.mjs';

export {
  vaultDoctor,
  vaultGetStatus,
  vaultHistory,
  vaultIsLinkedFile,
  vaultLinkProject,
  vaultListProjects,
  vaultMigrateLegacyProject,
  vaultPurgeProject,
  vaultRestoreProject,
  vaultRestoreRevision,
  vaultSyncProject,
  vaultUnlinkProject
} from './env-vault/secure-engine.mjs';

export { watchVaultProject } from './env-vault/watcher.mjs';

export { vaultRoot as getVaultHome } from './env-vault/common.mjs';
