// Plain words for account roles: dispatchers never see the code names.
const LABELS: Record<string, string> = {
  eso: 'Operator', student_responder: 'First responder', blood_donor: 'Blood donor',
  doctor: 'Doctor', nurse: 'Nurse', citizen: 'Citizen',
};
export const roleLabel = (role: string) => LABELS[role] ?? role.replace('_', ' ');
