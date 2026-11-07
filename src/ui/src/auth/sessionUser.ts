import type { User } from '@supabase/supabase-js';

import type { SessionUser } from '../app/slices/session';

/** The display name: `user_metadata.full_name` when the account has one, otherwise the email address. */
export function toSessionUser(user: User): SessionUser {
  const metadataName: unknown = user.user_metadata.full_name;
  const email = user.email ?? null;
  const fullName =
    typeof metadataName === 'string' && metadataName.trim() !== ''
      ? metadataName
      : (email ?? user.id);
  return { id: user.id, email, fullName };
}
