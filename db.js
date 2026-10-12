const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default initial state
function getDefaultData() {
  const defaultPassword = process.env.ADMIN_PASSWORD || 'dialight2026';
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(defaultPassword, salt);

  return {
    admin: {
      username: process.env.ADMIN_USERNAME || 'admin',
      passwordHash: passwordHash,
      displayName: 'Coach Imole Tobi',
      updatedAt: new Date().toISOString()
    },
    match: {
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
      sofaScoreUrl: 'https://www.sofascore.com',
      note: 'Updates automatically on match day',
      updatedAt: new Date().toISOString()
    },
    fixtures: [
      {
        id: 'fix-1',
        date: 'Sat 17 Oct',
        time: '3:00 pm',
        homeTeam: 'Dialight U13',
        awayTeam: 'Sample Academy',
        competition: 'Youth League',
        status: 'Upcoming',
        result: '3:00 pm',
        isResult: false
      },
      {
        id: 'fix-2',
        date: 'Sat 24 Oct',
        time: '4:00 pm',
        homeTeam: 'Dialight U17',
        awayTeam: 'Sample FC',
        competition: 'Academy Cup',
        status: 'Upcoming',
        result: '4:00 pm',
        isResult: false
      },
      {
        id: 'fix-3',
        date: 'Sat 3 Oct',
        time: 'Full Time',
        homeTeam: 'Dialight Free Age',
        awayTeam: 'Sample United',
        competition: 'Friendly',
        status: 'Finished',
        result: 'W 2–0',
        isResult: true
      }
    ],
    photos: [],
    videos: [
      {
        id: 'vid-1',
        title: 'Featured: Match highlights',
        category: 'featured',
        url: '',
        youtubeId: '',
        caption: 'U17 Tournament highlights from Adura field',
        createdAt: new Date().toISOString()
      },
      {
        id: 'vid-2',
        title: 'Training session',
        category: 'training',
        url: '',
        youtubeId: '',
        caption: 'Passing & tactical drills',
        createdAt: new Date().toISOString()
      },
      {
        id: 'vid-3',
        title: 'Player spotlight',
        category: 'spotlight',
        url: '',
        youtubeId: '',
        caption: 'Future star development',
        createdAt: new Date().toISOString()
      }
    ],
    trials: [],
    news: [
      {
        id: 'news-1',
        title: 'Official Training Schedule Update',
        content: 'All training sessions are confirmed for Mondays, Wednesdays & Fridays at Adura Field. U10 & U13 squads train from 3:00 PM to 5:00 PM. U17 & Free Age squads train from 4:00 PM to 6:00 PM.',
        category: 'Training',
        date: 'Mon, 12 Oct 2026',
        time: '4:00 PM',
        location: 'Adura Field, Alagbado, Lagos',
        badge: 'Schedule',
        attachmentUrl: '',
        createdAt: new Date().toISOString()
      },
      {
        id: 'news-2',
        title: 'Open Player Trials: U10, U13, U17 & Free Age',
        content: 'Registration and scouting trials are officially active for players of all age grades at Adura Field, Alagbado.',
        category: 'Trials',
        date: 'Mon, 12 Oct 2026',
        time: '3:00 PM – 6:00 PM',
        location: 'Adura Field, Alagbado, Lagos',
        badge: 'Open Trials',
        attachmentUrl: '',
        createdAt: new Date().toISOString()
      },

    ],
    settings: {
      academyName: 'Dialight Football Academy',
      motto: 'Breeding the Future Stars',
      founder: 'Coach Imole Tobi',
      phone: '+234 814 053 2536',
      whatsapp: '2348140532536',
      address: 'Under the Powerline field, Adura, Alagbado, Lagos',
      trainingDays: 'Mondays, Wednesdays & Fridays: 3:00 PM – 5:00 PM (U10/U13) | 4:00 PM – 6:00 PM (U17/Free Age)',
      instagram: 'https://instagram.com/dialightfa',
      facebook: 'https://facebook.com/dialightfa',
      youtube: 'https://youtube.com/@dialightfa'
    }
  };
}

// Load DB from file or create defaults
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const data = JSON.parse(raw);
      return data;
    }
  } catch (err) {
    console.error('Error loading db.json, recreating defaults:', err.message);
  }
  const defaultData = getDefaultData();
  saveDB(defaultData);
  return defaultData;
}

// Save DB atomically using a temporary file
function saveDB(data) {
  try {
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('Error saving db.json:', err.message);
    // fallback direct write
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  }
}

// DB state in memory
let db = loadDB();

module.exports = {
  get: () => db,
  save: () => saveDB(db),
  reload: () => {
    db = loadDB();
    return db;
  }
};
