require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Admin, Match, Fixture, Photo, Video, Trial, Setting, News, seedDefaults } = require('./models');
const jsonDb = require('./db'); // fallback if mongo is offline

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dialight_fa_jwt_secret_key_2026';
const MONGODB_URI = process.env.MONGODB_URI;

let isMongoConnected = false;

// Connect to MongoDB
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000
  }).then(async () => {
    isMongoConnected = true;
    console.log('✓ Successfully connected to MongoDB Atlas!');
    await seedDefaults();
  }).catch((err) => {
    console.warn('⚠ MongoDB connection failed, falling back to local storage:', err.message);
  });
}

// Uploads directory
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve static uploads
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const unique = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    cb(null, `${cleanBase}_${unique}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif|mp4|webm|mov/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const mime = file.mimetype.toLowerCase();
    if (allowed.test(ext) || allowed.test(mime)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image and video files are permitted.'));
    }
  }
});

// Multer instance for news attachments (accepts images, videos, PDFs, docs)
const attachmentUpload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = /jpeg|jpg|png|webp|gif|mp4|webm|mov|pdf|doc|docx|xls|xlsx|ppt|pptx|txt/;
    const allowedMimes = /image\/|video\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats|application\/vnd\.ms-|text\//;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const mime = file.mimetype.toLowerCase();
    if (allowedExts.test(ext) || allowedMimes.test(mime)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type for attachment.'));
    }
  }
});

// Multer instance for video uploads (MP4, MOV, WebM, MKV, AVI)
const videoUpload = multer({
  storage: storage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB max for video files
  fileFilter: (req, file, cb) => {
    const allowed = /mp4|webm|mov|m4v|mkv|avi|quicktime|video\//i;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const mime = file.mimetype.toLowerCase();
    if (allowed.test(ext) || allowed.test(mime)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video format. Please upload an MP4, MOV, WebM or MKV video file.'));
    }
  }
});

// Auth Middleware
function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
}

// -------------------------------------------------------------------
// ROOT & HEALTH CHECK
// -------------------------------------------------------------------
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    academy: 'Dialight Football Academy API',
    database: isMongoConnected ? 'mongodb_atlas' : 'local_json',
    endpoints: {
      health: '/api/health',
      news: '/api/news',
      fixtures: '/api/fixtures',
      matchLive: '/api/match/live',
      photos: '/api/photos',
      videos: '/api/videos'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: isMongoConnected ? 'mongodb' : 'local_json',
    academy: 'Dialight Football Academy',
    version: '1.0.0',
    time: new Date().toISOString()
  });
});

// -------------------------------------------------------------------
// AUTHENTICATION
// -------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  let adminUser = null;
  if (isMongoConnected) {
    adminUser = await Admin.findOne({ username: new RegExp(`^${username.trim()}$`, 'i') });
  } else {
    const localData = jsonDb.get();
    if (localData.admin && localData.admin.username.toLowerCase() === username.trim().toLowerCase()) {
      adminUser = localData.admin;
    }
  }

  if (!adminUser) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const validPassword = bcrypt.compareSync(password, adminUser.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = jwt.sign(
    { username: adminUser.username, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    success: true,
    token,
    user: {
      username: adminUser.username,
      displayName: adminUser.displayName || 'Coach Imole Tobi'
    }
  });
});

app.get('/api/auth/me', verifyAdmin, async (req, res) => {
  if (isMongoConnected) {
    const adminUser = await Admin.findOne({ username: req.admin.username });
    if (adminUser) {
      return res.json({
        authenticated: true,
        user: {
          username: adminUser.username,
          displayName: adminUser.displayName
        }
      });
    }
  }
  const localData = jsonDb.get();
  res.json({
    authenticated: true,
    user: {
      username: localData.admin.username,
      displayName: localData.admin.displayName
    }
  });
});

app.post('/api/auth/change-password', verifyAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  if (isMongoConnected) {
    const adminUser = await Admin.findOne({ username: req.admin.username });
    if (!adminUser || !bcrypt.compareSync(currentPassword, adminUser.passwordHash)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    adminUser.passwordHash = bcrypt.hashSync(newPassword, 10);
    adminUser.updatedAt = new Date();
    await adminUser.save();
    return res.json({ success: true, message: 'Password updated successfully.' });
  }

  const data = jsonDb.get();
  if (!bcrypt.compareSync(currentPassword, data.admin.passwordHash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }
  data.admin.passwordHash = bcrypt.hashSync(newPassword, 10);
  data.admin.updatedAt = new Date().toISOString();
  jsonDb.save();

  res.json({ success: true, message: 'Password updated successfully.' });
});

// -------------------------------------------------------------------
// MATCH & LIVE SCORES
// -------------------------------------------------------------------
app.get('/api/match/live', async (req, res) => {
  if (isMongoConnected) {
    const match = await Match.findOne().sort({ updatedAt: -1 });
    if (match) return res.json(match);
  }
  const data = jsonDb.get();
  res.json(data.match);
});

app.put('/api/match/live', verifyAdmin, async (req, res) => {
  const updates = req.body;

  if (isMongoConnected) {
    let match = await Match.findOne().sort({ updatedAt: -1 });
    if (!match) {
      match = new Match(updates);
    } else {
      Object.assign(match, updates, { updatedAt: new Date() });
    }
    await match.save();
    return res.json({ success: true, match });
  }

  const data = jsonDb.get();
  data.match = {
    ...data.match,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  jsonDb.save();
  res.json({ success: true, match: data.match });
});

// -------------------------------------------------------------------
// FIXTURES & RESULTS
// -------------------------------------------------------------------
app.get('/api/fixtures', async (req, res) => {
  if (isMongoConnected) {
    const fixtures = await Fixture.find().sort({ createdAt: -1 });
    return res.json(fixtures.map(f => ({
      id: f._id.toString(),
      date: f.date,
      time: f.time,
      result: f.result,
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      competition: f.competition,
      status: f.status,
      isResult: f.isResult
    })));
  }
  const data = jsonDb.get();
  res.json(data.fixtures || []);
});

app.post('/api/fixtures', verifyAdmin, async (req, res) => {
  const { date, time, homeTeam, awayTeam, competition, status, result, isResult } = req.body;
  if (!date || !homeTeam || !awayTeam) {
    return res.status(400).json({ error: 'Date, home team, and away team are required.' });
  }

  const payload = {
    date: date.trim(),
    time: time || '3:00 pm',
    homeTeam: homeTeam.trim(),
    awayTeam: awayTeam.trim(),
    competition: competition || 'Friendly',
    status: status || 'Upcoming',
    result: result || time || 'Upcoming',
    isResult: Boolean(isResult)
  };

  if (isMongoConnected) {
    const fix = await Fixture.create(payload);
    return res.status(201).json({
      success: true,
      fixture: {
        id: fix._id.toString(),
        ...payload
      }
    });
  }

  const data = jsonDb.get();
  const newFixture = {
    id: `fix-${Date.now()}`,
    ...payload,
    createdAt: new Date().toISOString()
  };
  data.fixtures = data.fixtures || [];
  data.fixtures.unshift(newFixture);
  jsonDb.save();

  res.status(201).json({ success: true, fixture: newFixture });
});

app.delete('/api/fixtures/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  if (isMongoConnected && mongoose.isValidObjectId(id)) {
    await Fixture.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Fixture deleted.' });
  }

  const data = jsonDb.get();
  data.fixtures = (data.fixtures || []).filter(f => f.id !== id);
  jsonDb.save();

  res.json({ success: true, message: 'Fixture deleted.' });
});

// -------------------------------------------------------------------
// GALLERY & PHOTOS
// -------------------------------------------------------------------
app.get('/api/photos', async (req, res) => {
  const { category } = req.query;

  if (isMongoConnected) {
    const filter = (category && category !== 'all') ? { category } : {};
    const photos = await Photo.find(filter).sort({ uploadedAt: -1 });
    return res.json(photos.map(p => ({
      id: p._id.toString(),
      filename: p.filename,
      url: p.dataUrl || p.url, // serves dataUrl if local disk image is unavailable
      title: p.title,
      category: p.category,
      caption: p.caption,
      layout: p.layout,
      uploadedAt: p.uploadedAt
    })));
  }

  const data = jsonDb.get();
  let photos = data.photos || [];
  if (category && category !== 'all') {
    photos = photos.filter(p => p.category === category);
  }
  res.json(photos);
});

app.post('/api/photos/upload', verifyAdmin, upload.single('image'), async (req, res) => {
  const { title, category, caption, layout } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Please choose an image file to upload.' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;

  // Read small/medium image buffer as dataURL for persistent MongoDB storage
  let dataUrl = '';
  try {
    const buffer = fs.readFileSync(req.file.path);
    dataUrl = `data:${req.file.mimetype};base64,${buffer.toString('base64')}`;
  } catch (e) {
    console.warn('Could not encode image buffer:', e.message);
  }

  const photoPayload = {
    filename: req.file.filename,
    url: fileUrl,
    dataUrl: dataUrl,
    title: title ? title.trim() : (req.file.originalname || 'Academy Photo'),
    category: category || 'match',
    caption: caption ? caption.trim() : '',
    layout: layout || 'normal',
    uploadedAt: new Date()
  };

  if (isMongoConnected) {
    const p = await Photo.create(photoPayload);
    return res.status(201).json({
      success: true,
      photo: {
        id: p._id.toString(),
        filename: p.filename,
        url: p.dataUrl || p.url,
        title: p.title,
        category: p.category,
        caption: p.caption,
        layout: p.layout,
        uploadedAt: p.uploadedAt
      }
    });
  }

  const data = jsonDb.get();
  const newPhoto = {
    id: `photo-${Date.now()}`,
    ...photoPayload,
    uploadedAt: new Date().toISOString()
  };
  data.photos = data.photos || [];
  data.photos.unshift(newPhoto);
  jsonDb.save();

  res.status(201).json({ success: true, photo: newPhoto });
});

app.delete('/api/photos/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;

  if (isMongoConnected && mongoose.isValidObjectId(id)) {
    const photo = await Photo.findById(id);
    if (photo && photo.filename) {
      const filePath = path.join(UPLOADS_DIR, photo.filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    }
    await Photo.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Photo deleted successfully.' });
  }

  const data = jsonDb.get();
  const photo = (data.photos || []).find(p => p.id === id);
  if (photo && photo.filename) {
    const filePath = path.join(UPLOADS_DIR, photo.filename);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }
  data.photos = (data.photos || []).filter(p => p.id !== id);
  jsonDb.save();

  res.json({ success: true, message: 'Photo deleted successfully.' });
});

// -------------------------------------------------------------------
// VIDEOS (Direct file attachment uploads and Easy YouTube)
// -------------------------------------------------------------------
app.get('/api/videos', async (req, res) => {
  if (isMongoConnected) {
    const videos = await Video.find().sort({ createdAt: -1 });
    return res.json(videos.map(v => ({
      id: v._id.toString(),
      title: v.title,
      category: v.category || 'highlight',
      videoType: v.videoType || (v.youtubeId ? 'youtube' : 'upload'),
      url: v.url,
      filename: v.filename || '',
      youtubeId: v.youtubeId || '',
      caption: v.caption || '',
      createdAt: v.createdAt
    })));
  }
  const data = jsonDb.get();
  res.json(data.videos || []);
});

app.post('/api/videos', verifyAdmin, (req, res, next) => {
  videoUpload.single('video')(req, res, function (err) {
    if (err) {
      return res.status(400).json({ error: err.message || 'Error processing video file.' });
    }
    next();
  });
}, async (req, res) => {
  const { title, category, url, youtubeId, caption } = req.body;

  let finalTitle = (title || '').trim();
  let finalCategory = category || 'highlight';
  let finalCaption = (caption || '').trim();
  let videoType = 'upload';
  let fileUrl = '';
  let filename = '';
  let extractedYtId = '';

  if (req.file) {
    // 📁 Direct video file attachment upload
    videoType = 'upload';
    filename = req.file.filename;
    fileUrl = `/uploads/${req.file.filename}`;
    if (!finalTitle) {
      const parsed = path.parse(req.file.originalname);
      finalTitle = parsed.name.replace(/[_-]/g, ' ');
    }
  } else {
    // 🔴 Easy YouTube addition (from link, video ID, shorts, embed, etc.)
    videoType = 'youtube';
    const inputVal = (youtubeId || url || '').trim();

    // Universal YouTube extractor:
    // Handles:
    // - Standard watch: youtube.com/watch?v=ID
    // - Short: youtu.be/ID
    // - Shorts: youtube.com/shorts/ID
    // - Embed: youtube.com/embed/ID
    // - Iframe code: <iframe src="...youtube.com/embed/ID...">
    // - Raw 11-char ID: e.g. "dQw4w9WgXcQ"
    const ytMatch = inputVal.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/);
    if (ytMatch && ytMatch[1]) {
      extractedYtId = ytMatch[1];
    } else if (/^[a-zA-Z0-9_-]{11}$/.test(inputVal)) {
      extractedYtId = inputVal;
    }

    if (!extractedYtId && !inputVal) {
      return res.status(400).json({ error: 'Please choose a video file to upload or provide a YouTube video.' });
    }

    fileUrl = extractedYtId ? `https://www.youtube.com/watch?v=${extractedYtId}` : inputVal;
    if (!finalTitle) {
      finalTitle = 'Academy Match Video';
    }
  }

  const payload = {
    title: finalTitle,
    category: finalCategory,
    videoType,
    url: fileUrl,
    filename,
    youtubeId: extractedYtId,
    caption: finalCaption,
    createdAt: new Date()
  };

  if (isMongoConnected) {
    const v = await Video.create(payload);
    return res.status(201).json({
      success: true,
      video: {
        id: v._id.toString(),
        ...payload
      }
    });
  }

  const data = jsonDb.get();
  const newVideo = {
    id: `vid-${Date.now()}`,
    ...payload,
    createdAt: new Date().toISOString()
  };
  data.videos = data.videos || [];
  data.videos.unshift(newVideo);
  jsonDb.save();

  res.status(201).json({ success: true, video: newVideo });
});

app.delete('/api/videos/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;

  if (isMongoConnected && mongoose.isValidObjectId(id)) {
    const video = await Video.findById(id);
    if (video && video.filename) {
      const filePath = path.join(UPLOADS_DIR, video.filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    }
    await Video.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Video deleted successfully.' });
  }

  const data = jsonDb.get();
  const video = (data.videos || []).find(v => v.id === id);
  if (video && video.filename) {
    const filePath = path.join(UPLOADS_DIR, video.filename);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }
  data.videos = (data.videos || []).filter(v => v.id !== id);
  jsonDb.save();

  res.json({ success: true, message: 'Video deleted successfully.' });
});

// -------------------------------------------------------------------
// TRIAL REGISTRATIONS (JOIN FORM)
// -------------------------------------------------------------------
app.post('/api/trials', async (req, res) => {
  const { playerName, ageGroup, phone, message } = req.body;

  if (!playerName || !phone) {
    return res.status(400).json({ error: 'Player name and phone number are required.' });
  }

  const payload = {
    playerName: playerName.trim(),
    ageGroup: ageGroup || 'Under 10',
    phone: phone.trim(),
    message: message ? message.trim() : '',
    status: 'New'
  };

  if (isMongoConnected) {
    const trial = await Trial.create(payload);
    return res.status(201).json({
      success: true,
      message: 'Thank you! Your trial request has been submitted. Coach Imole will contact you via WhatsApp soon.',
      trial: {
        id: trial._id.toString(),
        ...payload,
        submittedAt: trial.submittedAt
      }
    });
  }

  const data = jsonDb.get();
  const newTrial = {
    id: `trial-${Date.now()}`,
    ...payload,
    submittedAt: new Date().toISOString()
  };
  data.trials = data.trials || [];
  data.trials.unshift(newTrial);
  jsonDb.save();

  res.status(201).json({
    success: true,
    message: 'Thank you! Your trial request has been submitted. Coach Imole will contact you via WhatsApp soon.',
    trial: newTrial
  });
});

app.get('/api/trials', verifyAdmin, async (req, res) => {
  if (isMongoConnected) {
    const trials = await Trial.find().sort({ submittedAt: -1 });
    return res.json(trials.map(t => ({
      id: t._id.toString(),
      playerName: t.playerName,
      ageGroup: t.ageGroup,
      phone: t.phone,
      message: t.message,
      status: t.status,
      submittedAt: t.submittedAt
    })));
  }
  const data = jsonDb.get();
  res.json(data.trials || []);
});

app.delete('/api/trials/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  if (isMongoConnected && mongoose.isValidObjectId(id)) {
    await Trial.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Registration deleted.' });
  }

  const data = jsonDb.get();
  data.trials = (data.trials || []).filter(t => t.id !== id);
  jsonDb.save();

  res.json({ success: true, message: 'Registration deleted.' });
});

// -------------------------------------------------------------------
// ACADEMY SETTINGS
// -------------------------------------------------------------------
app.get('/api/settings', async (req, res) => {
  if (isMongoConnected) {
    const setting = await Setting.findOne();
    if (setting) return res.json(setting);
  }
  const data = jsonDb.get();
  res.json(data.settings || {});
});

// -------------------------------------------------------------------
// NEWS & ANNOUNCEMENTS (WITH DATE & TIME)
// -------------------------------------------------------------------
app.get('/api/news', async (req, res) => {
  if (isMongoConnected) {
    const newsList = await News.find().sort({ createdAt: -1 });
    return res.json(newsList.map(n => ({
      id: n._id.toString(),
      title: n.title,
      content: n.content,
      category: n.category,
      date: n.date,
      time: n.time,
      location: n.location,
      badge: n.badge,
      attachmentUrl: n.attachmentUrl || '',
      attachmentName: n.attachmentName || '',
      createdAt: n.createdAt
    })));
  }
  const data = jsonDb.get();
  res.json(data.news || []);
});

app.post('/api/news', verifyAdmin, attachmentUpload.single('attachment'), async (req, res) => {
  const { title, content, category, date, time, location, badge } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'News headline is required.' });
  }

  // Build attachment URL: prefer uploaded file, fall back to URL string from body
  let resolvedAttachmentUrl = '';
  if (req.file) {
    resolvedAttachmentUrl = `/uploads/${req.file.filename}`;
  } else if (req.body.attachmentUrl) {
    resolvedAttachmentUrl = req.body.attachmentUrl.trim();
  }

  const payload = {
    title: title.trim(),
    content: content ? content.trim() : '',
    category: category || 'Announcement',
    date: date ? date.trim() : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: time ? time.trim() : new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    location: location ? location.trim() : 'Adura Field, Alagbado, Lagos',
    badge: badge ? badge.trim() : 'Latest',
    attachmentUrl: resolvedAttachmentUrl,
    attachmentName: req.file ? req.file.originalname : ''
  };

  if (isMongoConnected) {
    const n = await News.create(payload);
    return res.status(201).json({
      success: true,
      news: {
        id: n._id.toString(),
        ...payload,
        createdAt: n.createdAt
      }
    });
  }

  const data = jsonDb.get();
  const newNews = {
    id: `news-${Date.now()}`,
    ...payload,
    createdAt: new Date().toISOString()
  };
  data.news = data.news || [];
  data.news.unshift(newNews);
  jsonDb.save();

  res.status(201).json({ success: true, news: newNews });
});

app.delete('/api/news/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  if (isMongoConnected && mongoose.isValidObjectId(id)) {
    await News.findByIdAndDelete(id);
    return res.json({ success: true, message: 'News item deleted.' });
  }

  const data = jsonDb.get();
  data.news = (data.news || []).filter(n => n.id !== id);
  jsonDb.save();

  res.json({ success: true, message: 'News item deleted.' });
});

// Serve frontend if visited directly
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
if (fs.existsSync(FRONTEND_DIR)) {
  app.use(express.static(FRONTEND_DIR));
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'admin.html'));
  });
}

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// General error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` Dialight Football Academy Backend Live! `);
  console.log(` Port: ${PORT}                           `);
  console.log(` Database: MongoDB Atlas                 `);
  console.log(` Uploads: ${UPLOADS_DIR}                 `);
  console.log(` Mode: ${process.env.NODE_ENV || 'development'} `);
  console.log(`=========================================`);
});
