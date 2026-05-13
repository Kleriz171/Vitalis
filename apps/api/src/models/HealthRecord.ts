import { Schema, model } from 'mongoose';

const MedicationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  dosage: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const Medication = model('Medication', MedicationSchema);

const AllergySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  allergen: { type: String, required: true },
  severity: { type: String, enum: ['mild', 'moderate', 'severe'], default: 'mild' },
}, { timestamps: true });

export const Allergy = model('Allergy', AllergySchema);

const VaccinationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  date: Date,
  provider: String,
}, { timestamps: true });

export const Vaccination = model('Vaccination', VaccinationSchema);

const AppointmentSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  doctor: { type: Schema.Types.ObjectId, ref: 'Doctor' },
  appointmentType: { type: String, enum: ['consultation', 'emergency', 'checkup'], default: 'consultation' },
  scheduledAt: { type: Date, required: true },
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled', index: true },
  notes: String,
}, { timestamps: true });

export const Appointment = model('Appointment', AppointmentSchema);

const ConditionSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  notes: String,
}, { timestamps: true });

export const Condition = model('Condition', ConditionSchema);

const DisabilitySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  notes: String,
}, { timestamps: true });

export const Disability = model('Disability', DisabilitySchema);
