import { t } from './i18n';

// Same lists as apps/api/src/models/User.ts. Staff accounts use the desktop console, not this app.
export const RESPONDER_ROLES = ['doctor', 'nurse', 'student_responder'];
export const STAFF_ROLES = ['eso', 'admin', 'hospital'];

export const roleLabel = (role?: string) => ({
  doctor: t('Doctor'),
  nurse: t('Nurse'),
  student_responder: t('Certified first-aider'),
  blood_donor: t('Blood donor'),
  citizen: t('Citizen'),
} as Record<string, string>)[role ?? ''] ?? t('Citizen');
