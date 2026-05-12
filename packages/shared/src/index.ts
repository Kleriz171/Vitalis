export type Role = 'citizen' | 'blood_donor' | 'doctor' | 'nurse' | 'student_responder' | 'dispatcher' | 'admin';
export type EmergencyStatus = 'pending' | 'assigned' | 'en_route' | 'on_scene' | 'resolved' | 'cancelled';
export type EmergencyType = 'medical' | 'trauma' | 'cardiac' | 'blood_needed' | 'rare_medicine' | 'other';

export interface GeoPoint { type: 'Point'; coordinates: [number, number] }

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; role: Role };
}
