import React from 'react';

interface Props {
  role: string;
  onChange: (role: 'admin' | 'nurse' | 'scheduler' | 'readonly') => void;
}

export function RoleDropdown({ role, onChange }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label htmlFor="role-select" style={{ fontWeight: 600 }}>
        Viewing as:
      </label>
      <select
        id="role-select"
        value={role}
        onChange={(e) => onChange(e.target.value as 'admin' | 'nurse' | 'scheduler' | 'readonly')}
        style={{
          padding: '6px 12px',
          borderRadius: 4,
          border: '1px solid #ccc',
          fontSize: 14,
        }}
      >
        <option value="admin">Admin</option>
        <option value="nurse">Nurse</option>
        <option value="scheduler">Scheduler</option>
        <option value="readonly">Read-Only</option>
      </select>
    </div>
  );
}
