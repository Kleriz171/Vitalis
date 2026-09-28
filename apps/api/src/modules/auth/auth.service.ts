import { User, ageOf } from '../../models/User';
import { signAccess, signRefresh, verifyRefresh } from '../../utils/jwt';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Allergy, Condition, Medication, Vaccination } from '../../models/HealthRecord';
import { PhoneCode } from '../../models/PhoneCode';
import { env } from '../../config/env';
import { sendSms, smsIsFake } from '../../utils/sms';

const MIN = 60_000;
const CODE_TTL = 10 * MIN;
const RESEND_AFTER = 30_000;
const SEND_WINDOW = 60 * MIN;
const MAX_SENDS = 5;
const MAX_ATTEMPTS = 5;
// Separate key so a signup token can never pass as an access token.
const signupSecret = `${env.jwtAccess}:phone-signup`;

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const hashCode = (phone: string, code: string) => createHmac('sha256', env.jwtAccess).update(`${phone}:${code}`).digest();

export type PhoneRegisterInput = {
  signupToken: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  emergencyContact: { name: string; phone: string };
  bloodType: string; // one of BLOOD_TYPES or 'unknown'
  allergies: Array<{ allergen: string; severity: 'mild' | 'moderate' | 'severe' }>;
  medications: Array<{ name: string; dosage?: string }>;
  conditions: string[];
};

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
  phone: user.phone,
  name: user.name,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  bloodType: user.bloodType,
  age: ageOf(user),
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
    // Phone-only accounts have no password: same 401 as a wrong one, no hint which.
    if (!user?.password) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    const ok = await bcrypt.compare(password, user.password);
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
  /** Sends a 6-digit code. Rate-limited per number on top of the per-IP limiter. */
  async startPhone(phone: string) {
    const now = Date.now();
    const prev = await PhoneCode.findOne({ phone }).lean();
    if (prev && now - prev.lastSentAt.getTime() < RESEND_AFTER) {
      throw fail(429, 'Wait a few seconds before asking for a new code.');
    }
    const freshWindow = !prev || now - prev.windowStart.getTime() >= SEND_WINDOW;
    const sends = freshWindow ? 1 : prev.sendsInWindow + 1;
    if (sends > MAX_SENDS) throw fail(429, 'Too many codes requested. Try again in an hour.');

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const windowStart = freshWindow ? new Date(now) : prev.windowStart;
    await PhoneCode.updateOne(
      { phone },
      {
        codeHash: hashCode(phone, code).toString('hex'),
        expiresAt: new Date(now + CODE_TTL),
        attempts: 0,
        lastSentAt: new Date(now),
        windowStart,
        sendsInWindow: sends,
        purgeAt: new Date(windowStart.getTime() + SEND_WINDOW),
      },
      { upsert: true },
    );
    await sendSms(phone, `Vitalis code: ${code}. It expires in 10 minutes. Never share it with anyone.`);
    // Dev without an SMS provider: hand the code back so the app and checks can proceed.
    return smsIsFake() ? { sent: true, devCode: code } : { sent: true };
  },

  /** Existing number → signed in. New number → a short-lived token to finish sign-up. */
  async verifyPhone(phone: string, code: string) {
    // Count the attempt atomically before comparing, so parallel guesses cannot exceed the cap.
    const doc = await PhoneCode.findOneAndUpdate(
      { phone, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { new: true },
    ).lean();
    if (!doc) throw fail(400, 'This code has expired or was tried too many times. Ask for a new one.');
    const expected = Buffer.from(doc.codeHash, 'hex');
    if (!timingSafeEqual(expected, hashCode(phone, code))) throw fail(400, 'That code is not right.');
    // Single use. Keep the document so the send-rate window survives.
    await PhoneCode.updateOne({ phone }, { expiresAt: new Date(0) });

    const user = await User.findOne({ phone }).select('+refreshTokenHash');
    if (user) return { isNew: false, ...(await this.issueTokens(user)) };
    const signupToken = jwt.sign({ phone, purpose: 'phone-signup' }, signupSecret, { expiresIn: '30m' });
    return { isNew: true, signupToken };
  },

  async registerPhone(input: PhoneRegisterInput) {
    let phone: string;
    try {
      const t = jwt.verify(input.signupToken, signupSecret) as { phone: string; purpose: string };
      if (t.purpose !== 'phone-signup') throw new Error();
      phone = t.phone;
    } catch {
      throw fail(401, 'Your sign-up session expired. Verify your number again.');
    }
    if (await User.exists({ phone })) throw fail(409, 'This number already has an account. Sign in instead.');

    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    let user;
    try {
      user = await User.create({
        phone,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        role: 'citizen',
        dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
        emergencyContact: { name: input.emergencyContact.name.trim(), phone: input.emergencyContact.phone },
        bloodType: input.bloodType === 'unknown' ? undefined : input.bloodType,
      });
    } catch (e: any) {
      if (e?.code === 11000) throw fail(409, 'This number already has an account. Sign in instead.');
      throw e;
    }
    const allergies = input.allergies.filter(a => a.allergen.trim());
    const medications = input.medications.filter(m => m.name.trim());
    const conditions = cleanStrings(input.conditions);
    await Promise.all([
      allergies.length && Allergy.insertMany(allergies.map(a => ({ user: user._id, allergen: a.allergen.trim(), severity: a.severity }))),
      medications.length && Medication.insertMany(medications.map(m => ({ user: user._id, name: m.name.trim(), dosage: m.dosage?.trim() || undefined, isActive: true }))),
      conditions.length && Condition.insertMany(conditions.map(name => ({ user: user._id, name }))),
    ]);
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
