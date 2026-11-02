// Plain words for account roles: dispatchers never see the code names.
const LABELS: Record<string, string> = {
  eso: 'Operator', admin: 'Administrator', hospital: 'Hospital staff',
  student_responder: 'First responder', blood_donor: 'Blood donor',
  doctor: 'Doctor', nurse: 'Nurse', citizen: 'Citizen',
};
export const roleLabel = (role: string) => LABELS[role] ?? role.replace('_', ' ');

// Who may sign in to the console and the page each one opens on: staff (models/User.ts STAFF_ROLES)
// and clinicians, whose consultation workspace lives here because a calendar needs a wide screen.
export const CONSOLE_HOME: Record<string, string> = {
  eso: '/command',
  admin: '/command/analytics',
  hospital: '/command/hospital/incoming',
  doctor: '/command/clinic',
  nurse: '/command/clinic',
};
export const STAFF_ROLES = ['eso', 'admin', 'hospital'];
export const RESPONDER_ROLES = ['doctor', 'nurse', 'student_responder'];
