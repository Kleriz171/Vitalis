// Plain words for account roles: dispatchers never see the code names.
const LABELS: Record<string, string> = {
  eso: 'Operator', admin: 'Administrator', hospital: 'Hospital staff',
  student_responder: 'First responder', blood_donor: 'Blood donor',
  doctor: 'Doctor', nurse: 'Nurse', citizen: 'Citizen',
};
export const roleLabel = (role: string) => LABELS[role] ?? role.replace('_', ' ');

// Console accounts (models/User.ts STAFF_ROLES) and the page each one opens on.
export const CONSOLE_HOME: Record<string, string> = {
  eso: '/command',
  admin: '/command/analytics',
  hospital: '/command/hospital',
};
export const STAFF_ROLES = Object.keys(CONSOLE_HOME);
export const RESPONDER_ROLES = ['doctor', 'nurse', 'student_responder'];
