/**
 * Key lifecycle matrix for the personal encrypted diary. UI/recovery flows in
 * later tasks bind to these outcomes; silent key rotation is never an option.
 */
export const DATABASE_KEY_LIFECYCLE = [
  {
    situation: 'first_launch_no_db',
    action: 'create_random_key_in_secure_store',
    opensPrivateDb: true,
  },
  {
    situation: 'reopen_with_vault_key',
    action: 'reuse_existing_key',
    opensPrivateDb: true,
  },
  {
    situation: 'db_present_key_missing',
    action: 'fail_closed_no_reset',
    opensPrivateDb: false,
  },
  {
    situation: 'wrong_key',
    action: 'reject_open',
    opensPrivateDb: false,
  },
  {
    situation: 'cipher_unavailable',
    action: 'refuse_plaintext_fallback',
    opensPrivateDb: false,
  },
  {
    situation: 'reinstall_without_keychain',
    action: 'require_external_backup_restore',
    opensPrivateDb: false,
  },
] as const;

export type DatabaseKeyLifecycleSituation = (typeof DATABASE_KEY_LIFECYCLE)[number]['situation'];
