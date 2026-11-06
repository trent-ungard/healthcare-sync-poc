import { useState, useCallback } from 'react';

type Role = 'admin' | 'nurse' | 'scheduler' | 'readonly';

export function useRole() {
  const [role, setRole] = useState<Role>('admin');
  const changeRole = useCallback((newRole: Role) => setRole(newRole), []);
  return { role, changeRole };
}
