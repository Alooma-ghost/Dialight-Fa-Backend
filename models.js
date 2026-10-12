const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 1. Admin Schema
const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, default: 'admin' },
  passwordHash: { type: String, required: true },
  displayName: { type: String, default: 'Coach Imole Tobi' },
  updatedAt: { type: Date, default: Date.now }
});

// 2. Match Schema
const MatchSchema = new mongoose.Schema({
  isLive: { type: Boolean, default: true },
  status: { type: String, default: 'Live' },
  minute: { type: String, default: "63'" },
  homeTeam: { type: String, default: 'Dialight U17' },
  homeShort: { type: String, default: 'DFA' },
  awayTeam: { type: String, default: 'Opponent FC' },
  awayShort: { type: String, default: 'OPP' },
  homeScore: { type: Number, default: 2 },
  awayScore: { type: Number, default: 1 },
  competition: { type: String, default: 'Demo match' },
  sofaScoreUrl: { type: String, default: 'https://www.sofascore.com' },
  note: { type: String, default: 'Updates automatically on match day' },
  updatedAt: { type: Date, default: Date.now }
});

// 3. Fixture Schema
const FixtureSchema = new mongoose.Schema({
  date: { type: String, required: true },
  time: { type: String, default: '3:00 pm' },
  result: { type: String, default: 'Upcoming' },
  homeTeam: { type: String, required: true },
  awayTeam: { type: String, required: true },
  competition: { type: String, default: 'Friendly' },
  status: { type: String, default: 'Upcoming' },
  isResult: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// 4. Photo Schema (includes dataUrl base64 for persistent cloud storage on Render free tier)
const PhotoSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  url: { type: String, required: true },
  dataUrl: { type: String, default: '' }, // allows image to be served directly from Mongo even if Render disk restarts
  title: { type: String, default: 'Academy Photo' },
  category: { type: String, default: 'match' }, // match, train, team, alumni
  caption: { type: String, default: '' },
  layout: { type: String, default: 'normal' }, // normal, wide, tall
  uploadedAt: { type: Date, default: Date.now }
});

// 5. Video Schema (supports both direct file attachment uploads and YouTube videos)
const VideoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, default: 'highlight' }, // highlight, training, feature
  videoType: { type: String, default: 'upload' }, // 'upload' | 'youtube'
  url: { type: String, default: '' },
  filename: { type: String, default: '' },
  youtubeId: { type: String, default: '' },
  caption: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// 6. Trial Registration Schema (for Join form)
const TrialSchema = new mongoose.Schema({
  playerName: { type: String, required: true },
  ageGroup: { type: String, default: 'Under 10' },
  phone: { type: String, required: true },
  message: { type: String, default: '' },
  status: { type: String, default: 'New' }, // New, Contacted, Trial Booked, Enrolled
  notes: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now }
});

// 7. Settings Schema
const SettingSchema = new mongoose.Schema({
  academyName: { type: String, default: 'Dialight Football Academy' },
  motto: { type: String, default: 'Breeding the Future Stars' },
  founder: { type: String, default: 'Coach Imole Tobi' },
  phone: { type: String, default: '+2348000000000' },
  whatsapp: { type: String, default: '2348000000000' },
  address: { type: String, default: 'Under the Powerline field, Adura, Alagbado, Lagos' },
  trainingDays: { type: String, default: 'Mondays, Wednesdays and Fridays, 3 pm to 6 pm' },
  instagram: { type: String, default: '' },
  facebook: { type: String, default: '' },
  youtube: { type: String, default: '' }
});

// 8. News Schema (with Date, Time, and Attachment)
const NewsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, default: '' },
  category: { type: String, default: 'Announcement' }, // Announcement, Trials, Match, Training
  date: { type: String, default: '' },
  time: { type: String, default: '' },
  location: { type: String, default: 'Adura Field, Alagbado, Lagos' },
  badge: { type: String, default: 'Latest' },
  attachmentUrl: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const Admin = mongoose.model('Admin', AdminSchema);
const Match = mongoose.model('Match', MatchSchema);
const Fixture = mongoose.model('Fixture', FixtureSchema);
const Photo = mongoose.model('Photo', PhotoSchema);
const Video = mongoose.model('Video', VideoSchema);
const Trial = mongoose.model('Trial', TrialSchema);
const Setting = mongoose.model('Setting', SettingSchema);
const News = mongoose.model('News', NewsSchema);

// Initial database seeding if empty
async function seedDefaults() {
  try {
    // 1. Admin
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      const defaultPassword = process.env.ADMIN_PASSWORD || 'dialight2026';
      const hash = bcrypt.hashSync(defaultPassword, 10);
      await Admin.create({
        username: process.env.ADMIN_USERNAME || 'admin',
        passwordHash: hash,
        displayName: 'Coach Imole Tobi'
      });
      console.log('Seed: Created initial admin user.');
    }

    // 2. Match
    const matchCount = await Match.countDocuments();
    if (matchCount === 0) {
      await Match.create({
        isLive: true,
        status: 'Live',
        minute: "63'",
        homeTeam: 'Dialight U17',
        homeShort: 'DFA',
        awayTeam: 'Opponent FC',
        awayShort: 'OPP',
        homeScore: 2,
        awayScore: 1,
        competition: 'Demo match',
        sofaScoreUrl: 'https://www.sofascore.com'
      });
      console.log('Seed: Created initial live match card.');
    }

    // 3. Fixtures
    const fixtureCount = await Fixture.countDocuments();
    if (fixtureCount === 0) {
      await Fixture.insertMany([
        {
          date: 'Sat 17 Oct',
          time: '3:00 pm',
          result: '3:00 pm',
          homeTeam: 'Dialight U13',
          awayTeam: 'Sample Academy',
          competition: 'Youth League',
          status: 'Upcoming',
          isResult: false
        },
        {
          date: 'Sat 24 Oct',
          time: '4:00 pm',
          result: '4:00 pm',
          homeTeam: 'Dialight U17',
          awayTeam: 'Sample FC',
          competition: 'Academy Cup',
          status: 'Upcoming',
          isResult: false
        },
        {
          date: 'Sat 3 Oct',
          time: 'Full Time',
          result: 'W 2–0',
          homeTeam: 'Dialight Free Age',
          awayTeam: 'Sample United',
          competition: 'Friendly',
          status: 'Finished',
          isResult: true
        }
      ]);
      console.log('Seed: Created initial fixtures.');
    }

    // 4. Videos
    const videoCount = await Video.countDocuments();
    if (videoCount === 0) {
      await Video.insertMany([
        {
          title: 'Featured: Match highlights',
          category: 'featured',
          url: '',
          youtubeId: '',
          caption: 'Highlights from Adura pitch matches'
        },
        {
          title: 'Training session',
          category: 'training',
          url: '',
          youtubeId: '',
          caption: 'Passing and tactical exercises'
        },
        {
          title: 'Player spotlight',
          category: 'spotlight',
          url: '',
          youtubeId: '',
          caption: 'Future star development pathway'
        }
      ]);
      console.log('Seed: Created initial video entries.');
    }

    // 6. News
    const newsCount = await News.countDocuments();
    if (newsCount === 0) {
      await News.insertMany([
        {
          title: 'Official Training Schedule Update',
          content: 'All training sessions are confirmed for Mondays, Wednesdays & Fridays. U10 & U13 squads train 3:00 PM – 5:00 PM. U17 & Free Age squads train 4:00 PM – 6:00 PM. All sessions at Adura Field, under the Powerline, Alagbado.',
          category: 'Training',
          date: 'Mon, 12 Oct 2026',
          time: '4:00 PM',
          location: 'Adura Field, Alagbado, Lagos',
          badge: 'Schedule'
        },
        {
          title: 'Open Player Trials: Under-10, U13, U17 & Free Age',
          content: 'Registration and trials are open for talented grassroots players across Lagos and Ogun states. Direct evaluation with Head Coach Imole Tobi.',
          category: 'Trials',
          date: 'Mon, 12 Oct 2026',
          time: '3:00 PM – 6:00 PM',
          location: 'Adura Field, Alagbado, Lagos',
          badge: 'Open Trials'
        },

      ]);
      console.log('Seed: Created initial news entries.');
    }
  } catch (err) {
    console.error('Error during database seed:', err.message);
  }
}

module.exports = {
  Admin,
  Match,
  Fixture,
  Photo,
  Video,
  Trial,
  Setting,
  News,
  seedDefaults
};
