import { User } from '../../models/User';
import { signAccess, signRefresh } from '../../utils/jwt';
import bcrypt from 'bcryptjs';

export const authService = {
  async register(input: { email: string; password: string; name: string; role?: string }) {
    const exists = await User.findOne({ email: input.email });
    if (exists) throw Object.assign(new Error('Email already used'), { status: 409 });
    const user = await User.create(input);
    return this.issueTokens(user);
  },
  async login(email: string, password: string) {
    const user = await User.findOne({ email }).select('+password +refreshTokenHash');
    if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    const ok = await bcrypt.compare(password, (user as any).password);
    if (!ok) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
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
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
    };
  },
};
