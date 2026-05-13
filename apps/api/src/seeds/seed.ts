import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { logger } from '../config/logger';
import { User } from '../models/User';
import { Hospital } from '../models/Hospital';
import { BloodRequest } from '../models/BloodRequest';
import { BloodInventory } from '../models/BloodInventory';
import { Doctor } from '../models/Doctor';
import { CommunityGroup } from '../models/CommunityGroup';
import { CommunityPost } from '../models/CommunityPost';
import { MedicineInventory } from '../models/MedicineInventory';
import { SupplyRequest } from '../models/SupplyRequest';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

// Tirana coords for demo
const TIRANA: [number, number] = [19.8189, 41.3275];
const jitter = (c: [number, number], r = 0.03): [number, number] =>
  [c[0] + (Math.random() - 0.5) * r, c[1] + (Math.random() - 0.5) * r];

async function seed() {
  await connectDB();

  logger.info('Clearing collections…');
  await Promise.all([
    Hospital.deleteMany({}),
    BloodRequest.deleteMany({}),
    BloodInventory.deleteMany({}),
    Doctor.deleteMany({}),
    CommunityGroup.deleteMany({}),
    CommunityPost.deleteMany({}),
    MedicineInventory.deleteMany({}),
    SupplyRequest.deleteMany({}),
  ]);

  // Demo users (idempotent on email)
  logger.info('Seeding demo users…');
  const demoUsers = [
    { email: 'demo@vitalis.dev', name: 'Demo Citizen', role: 'citizen', bloodType: 'O+' as const, password: 'demo1234' },
    { email: 'doctor@vitalis.dev', name: 'Dr. Field', role: 'doctor', bloodType: 'A+' as const, password: 'demo1234' },
    { email: 'dispatcher@vitalis.dev', name: 'Ops Dispatcher', role: 'dispatcher', bloodType: 'B+' as const, password: 'demo1234' },
  ];
  for (const u of demoUsers) {
    const existing = await User.findOne({ email: u.email });
    if (!existing) await User.create(u);
  }

  // Hospitals
  logger.info('Seeding hospitals…');
  const hospitals = await Hospital.insertMany([
    { name: 'Mother Teresa University Hospital', type: 'public', address: 'Rruga e Dibrës, Tirana', phone: '+355 4 222 2222', isOpen24h: true, location: { type: 'Point', coordinates: jitter(TIRANA) } },
    { name: 'American Hospital 1', type: 'private', address: 'Rruga e Kavajës, Tirana', phone: '+355 4 240 1234', isOpen24h: true, location: { type: 'Point', coordinates: jitter(TIRANA) } },
    { name: 'Hygeia Hospital', type: 'private', address: 'Rruga Janos Hunyadi, Tirana', phone: '+355 4 290 3000', isOpen24h: true, location: { type: 'Point', coordinates: jitter(TIRANA) } },
    { name: 'Memorial Hospital', type: 'private', address: 'Rruga e Durrësit, Tirana', phone: '+355 4 232 4444', isOpen24h: false, location: { type: 'Point', coordinates: jitter(TIRANA) } },
  ]);

  // Blood inventory: each hospital, each type
  logger.info('Seeding blood inventory…');
  const inv: any[] = [];
  for (const h of hospitals) {
    for (const t of BLOOD_TYPES) {
      const available = Math.floor(Math.random() * 30);
      const needed = Math.random() < 0.25 ? available + Math.floor(Math.random() * 8) + 1 : 0;
      inv.push({ hospital: h._id, bloodType: t, unitsAvailable: available, unitsNeeded: needed });
    }
  }
  await BloodInventory.insertMany(inv);

  // Blood requests
  logger.info('Seeding blood requests…');
  const requests = [
    { hospital: hospitals[0]._id, patientName: 'Anonymous patient #A-204', bloodType: 'O-' as const, urgency: 'critical' as const, unitsNeeded: 4, reason: 'Emergency transfusion post-trauma' },
    { hospital: hospitals[1]._id, patientName: 'Anonymous patient #B-118', bloodType: 'AB-' as const, urgency: 'urgent' as const, unitsNeeded: 2, reason: 'Scheduled surgery' },
    { hospital: hospitals[2]._id, patientName: 'Anonymous patient #C-307', bloodType: 'A+' as const, urgency: 'normal' as const, unitsNeeded: 1, reason: 'Chronic anemia' },
    { hospital: hospitals[0]._id, patientName: 'Anonymous patient #A-301', bloodType: 'B+' as const, urgency: 'urgent' as const, unitsNeeded: 3, reason: 'Postpartum hemorrhage' },
  ];
  await BloodRequest.insertMany(requests);

  logger.info('Seeding medicine inventory…');
  await MedicineInventory.insertMany([
    {
      pharmacy: { name: 'Central Pharmacy', phone: '+355 4 555 1100' },
      medicine: { name: 'Human Albumin 20%', atc: 'B05AA01' },
      stock: 3,
      rare: true,
      location: { type: 'Point', coordinates: jitter(TIRANA) },
    },
    {
      pharmacy: { name: 'CarePlus Tirana', phone: '+355 4 555 1101' },
      medicine: { name: 'Factor VIII Concentrate', atc: 'B02BD02' },
      stock: 2,
      rare: true,
      location: { type: 'Point', coordinates: jitter(TIRANA) },
    },
    {
      pharmacy: { name: 'University Hospital Pharmacy', phone: '+355 4 555 1102' },
      medicine: { name: 'Immunoglobulin IV', atc: 'J06BA02' },
      stock: 5,
      rare: true,
      location: { type: 'Point', coordinates: jitter(TIRANA) },
    },
    {
      pharmacy: { name: 'MedLife Pharmacy', phone: '+355 4 555 1103' },
      medicine: { name: 'Amoxicillin 500mg', atc: 'J01CA04' },
      stock: 42,
      rare: false,
      location: { type: 'Point', coordinates: jitter(TIRANA) },
    },
  ]);

  logger.info('Seeding supply exchange requests…');
  await SupplyRequest.insertMany([
    {
      category: 'organ',
      title: 'Urgent kidney transplant coordination',
      resourceType: 'Kidney',
      urgency: 'critical',
      quantityLabel: '1 matched donor',
      facilityName: hospitals[0].name,
      notes: 'Recipient prepared and cross-match window is open.',
    },
    {
      category: 'tissue',
      title: 'Corneal tissue request',
      resourceType: 'Cornea',
      urgency: 'urgent',
      quantityLabel: '2 grafts',
      facilityName: hospitals[1].name,
      notes: 'Needed for scheduled ophthalmic procedures this week.',
    },
    {
      category: 'medicine',
      title: 'Rare immunoglobulin stock request',
      resourceType: 'Immunoglobulin IV',
      urgency: 'urgent',
      quantityLabel: '4 vials',
      facilityName: hospitals[2].name,
      notes: 'Pediatric immunology case awaiting confirmation.',
    },
    {
      category: 'blood',
      title: 'Critical O- emergency stock transfer',
      resourceType: 'O- blood',
      urgency: 'critical',
      quantityLabel: '4 units',
      facilityName: hospitals[0].name,
      notes: 'Transfer support requested for trauma stabilization.',
    },
  ]);

  // Doctors
  logger.info('Seeding doctors…');
  const doctors = [
    { name: 'Dr. Elena Hoxha', specialty: 'Cardiology', hospital: hospitals[0]._id, experience: 12, rating: 4.9, reviewCount: 142, priceConsultation: 4500, availableOnline: true, availableNow: true, biography: 'Interventional cardiologist with focus on acute coronary syndromes.' },
    { name: 'Dr. Andi Berisha', specialty: 'Neurology', hospital: hospitals[1]._id, experience: 9, rating: 4.7, reviewCount: 88, priceConsultation: 5000, availableOnline: true, availableNow: false, biography: 'Headache and stroke specialist.' },
    { name: 'Dr. Lorena Marku', specialty: 'Pediatrics', hospital: hospitals[2]._id, experience: 7, rating: 4.8, reviewCount: 201, priceConsultation: 3500, availableOnline: true, availableNow: true, biography: 'Pediatrician — newborn to adolescent care.' },
    { name: 'Dr. Mark Gjoka', specialty: 'Orthopedics', hospital: hospitals[3]._id, experience: 15, rating: 4.6, reviewCount: 67, priceConsultation: 6000, availableOnline: false, availableNow: false, biography: 'Sports injuries and joint replacement.' },
    { name: 'Dr. Sara Çela', specialty: 'Dermatology', hospital: hospitals[1]._id, experience: 8, rating: 4.9, reviewCount: 156, priceConsultation: 4000, availableOnline: true, availableNow: true, biography: 'Skin oncology and cosmetic dermatology.' },
    { name: 'Dr. Petrit Doku', specialty: 'Endocrinology', hospital: hospitals[2]._id, experience: 11, rating: 4.7, reviewCount: 92, priceConsultation: 4500, availableOnline: true, availableNow: false, biography: 'Diabetes and thyroid disorders.' },
    { name: 'Dr. Ina Lleshi', specialty: 'Gastroenterology', hospital: hospitals[0]._id, experience: 10, rating: 4.5, reviewCount: 54, priceConsultation: 5500, availableOnline: false, availableNow: false, biography: 'GI endoscopy and liver disease.' },
    { name: 'Dr. Klodian Rama', specialty: 'Psychology', hospital: hospitals[1]._id, experience: 6, rating: 4.9, reviewCount: 178, priceConsultation: 3000, availableOnline: true, availableNow: true, biography: 'Anxiety, depression, CBT.' },
  ];
  await Doctor.insertMany(doctors);

  // Community groups
  logger.info('Seeding community groups…');
  const groups = await CommunityGroup.insertMany([
    { name: 'Living with Diabetes', description: 'Daily tips, recipes, glucose management.', category: 'diabetes', memberCount: 2842 },
    { name: 'Cancer Survivors', description: 'Support network for patients and families.', category: 'cancer', memberCount: 1276 },
    { name: 'Anxiety & Mental Health', description: 'A safe space to talk and listen.', category: 'anxiety', memberCount: 4521 },
    { name: 'New Parents', description: 'Newborn care, sleep, feeding.', category: 'parents', memberCount: 3104 },
    { name: 'Student Health', description: 'For university students balancing studies and wellbeing.', category: 'students', memberCount: 1893 },
    { name: 'Heart Health', description: 'Cardiac patients and prevention.', category: 'heart', memberCount: 982 },
    { name: 'Autoimmune Warriors', description: 'Lupus, MS, Crohn’s and more.', category: 'autoimmune', memberCount: 743 },
    { name: 'Rare Diseases', description: 'Connecting patients with rare conditions.', category: 'rare', memberCount: 412 },
  ]);

  // Community posts (a couple per group)
  logger.info('Seeding community posts…');
  const posts: any[] = [];
  const samplePosts = [
    'Just got my A1C results — down 0.8 points since switching to lower-carb breakfasts. Anyone else found small changes that stuck?',
    'Three months post-chemo and the fatigue is still real. How long did it take you to feel like yourself again?',
    'Therapist gave me a great grounding technique today — 5 things you see, 4 you hear, 3 you can touch, 2 you smell, 1 you taste. It actually helped during a panic spike.',
    'Tip for new parents: a white-noise machine changed everything for our 4-month-old.',
    'Anyone here juggling med school and a chronic condition? Looking for organisation tips.',
  ];
  groups.forEach((g, i) => {
    posts.push({
      group: g._id,
      authorName: 'Community member',
      isAnonymous: false,
      content: samplePosts[i % samplePosts.length],
      likes: Math.floor(Math.random() * 40),
      commentsCount: Math.floor(Math.random() * 12),
    });
    posts.push({
      group: g._id,
      isAnonymous: true,
      content: 'Posting anonymously — this group has helped me more than I can say. Thank you all.',
      likes: Math.floor(Math.random() * 30),
      commentsCount: Math.floor(Math.random() * 8),
    });
  });
  await CommunityPost.insertMany(posts);

  logger.info('✅ Seed complete.');
  await mongoose.disconnect();
}

seed().catch(err => {
  logger.error('Seed failed', err);
  process.exit(1);
});
