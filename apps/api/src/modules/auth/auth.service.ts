import { User } from '../../models/User';
import { signAccess, signRefresh, verifyRefresh } from '../../utils/jwt';
import bcrypt from 'bcryptjs';
import { Allergy, Medication, Vaccination } from '../../models/HealthRecord';

type RegisterInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
  bloodType?: string;
  age?: number;
  gender?: string;
  heightCm?: number;
  weightKg?: number;
  illnesses?: string[];
  disabilities?: string[];
  medications?: Array<{ name: string; dosage?: string; isActive?: boolean }>;
  allergies?: Array<{ allergen: string; severity?: 'mild' | 'moderate' | 'severe' }>;
  vaccinations?: Array<{ name: string; date?: string; provider?: string }>;
};

const cleanStrings = (items?: string[]) =>
  [...new Set((items ?? []).map(item => item.trim()).filter(Boolean))];

const serializeUser = (user: any) => ({
  id: user._id,
  email: user.email,
  name: user.name,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  bloodType: user.bloodType,
  age: user.age,
  gender: user.gender,
  heightCm: user.heightCm,
  weightKg: user.weightKg,
  illnesses: user.illnesses ?? [],
  disabilities: user.disabilities ?? [],
});

export const authService = {
  async register(input: RegisterInput) {
    const exists = await User.findOne({ email: input.email });
    if (exists) throw Object.assign(new Error('Email already used'), { status: 409 });

    const user = await User.create({
      email: input.email,
      password: input.password,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      name: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
      role: input.role ?? 'citizen',
      bloodType: input.bloodType,
      age: input.age,
      gender: input.gender,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      illnesses: cleanStrings(input.illnesses),
      disabilities: cleanStrings(input.disabilities),
    });

    if (input.medications?.length) {
      await Medication.insertMany(
        input.medications
          .filter(item => item.name.trim())
          .map(item => ({
            user: user._id,
            name: item.name.trim(),
            dosage: item.dosage?.trim(),
            isActive: item.isActive ?? true,
          }))
      );
    }

    if (input.allergies?.length) {
      await Allergy.insertMany(
        input.allergies
          .filter(item => item.allergen.trim())
          .map(item => ({
            user: user._id,
            allergen: item.allergen.trim(),
            severity: item.severity ?? 'mild',
          }))
      );
    }

    if (input.vaccinations?.length) {
      await Vaccination.insertMany(
        input.vaccinations
          .filter(item => item.name.trim())
          .map(item => ({
            user: user._id,
            name: item.name.trim(),
            date: item.date ? new Date(item.date) : undefined,
            provider: item.provider?.trim(),
          }))
      );
    }

    return this.issueTokens(user);
  },
  async login(email: string, password: string) {
    const user = await User.findOne({ email }).select('+password +refreshTokenHash');
    if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    const ok = await bcrypt.compare(password, (user as any).password);
    if (!ok) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    return this.issueTokens(user);
  },
  async refresh(refreshToken: string) {
    let decoded: { sub: string; role: string };
    try {
      decoded = verifyRefresh(refreshToken) as { sub: string; role: string };
    } catch {
      throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
    }

    const user = await User.findById(decoded.sub).select('+refreshTokenHash');
    if (!user || !user.refreshTokenHash) {
      throw Object.assign(new Error('Session expired'), { status: 401 });
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      throw Object.assign(new Error('Session expired'), { status: 401 });
    }

    return this.issueTokens(user);
  },
  async issueTokens(user: any) {
    const payload = { sub: user._id.toString(), role: user.role };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);
    user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await user.save();
    return {
      accessToken,
      refreshToken,
      user: serializeUser(user),
    };
  },
};
