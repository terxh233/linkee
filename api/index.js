// ============================================================
// Linkee Backend — Vercel Serverless Function
// Adapted from backend/server.js for Vercel deployment
// ============================================================

// Load env vars — in Vercel these come from the dashboard,
// but dotenv is kept for local `vercel dev` compatibility
try {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
} catch (e) {
  // dotenv may not be available in production — that's fine,
  // Vercel injects env vars directly
}

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

let OpenAI;
try {
  OpenAI = require('openai');
} catch (e) {
  console.warn('OpenAI package not available — AI features will be disabled');
}

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'linkee_jwt_secret_2024';

// === OpenAI Client ===
let openai = null;
if (OpenAI && process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// === JSON File Persistence Helpers ===
// On Vercel, only /tmp is writable. Data will NOT persist across cold starts.
const DATA_DIR = path.join('/tmp', 'linkee-data');

function readJSON(filename) {
  const filepath = path.join(DATA_DIR, filename);
  try {
    const raw = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function writeJSON(filename, data) {
  const filepath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Seed initial data from backend/data if /tmp is empty
function seedDataIfNeeded() {
  const seedDir = path.join(__dirname, '..', 'backend', 'data');
  const files = ['users.json', 'jobs.json', 'services.json', 'messages.json', 'contacts.json'];
  
  files.forEach(file => {
    const tmpPath = path.join(DATA_DIR, file);
    const seedPath = path.join(seedDir, file);
    
    if (!fs.existsSync(tmpPath) && fs.existsSync(seedPath)) {
      try {
        const data = fs.readFileSync(seedPath, 'utf-8');
        fs.writeFileSync(tmpPath, data, 'utf-8');
      } catch (e) {
        // Seed file doesn't exist or can't be read — start fresh
      }
    }
  });
}

seedDataIfNeeded();

// === Middleware ===
app.use(cors());
app.use(express.json());
// NOTE: Static files are served by Vercel's CDN, not Express

// === Auth Middleware ===
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = decoded;
    next();
  });
}

// Optional auth — attaches user if token present, but doesn't block
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err) req.user = decoded;
    });
  }
  next();
}

// ============================================================
//  AUTH ROUTES
// ============================================================

// POST /api/register
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role, providerCategory, nationalId, certificate } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const users = readJSON('users.json');
    const normalizedEmail = email.trim().toLowerCase();

    if (users.find(u => u.email === normalizedEmail)) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now(),
      name: name || '',
      email: normalizedEmail,
      password: hashedPassword,
      role: role || 'customer',
      providerCategory: role === 'provider' ? providerCategory : null,
      nationalId: role === 'provider' ? nationalId : null,
      certificate: role === 'provider' ? certificate : null,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeJSON('users.json', users);

    const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role, providerCategory: newUser.providerCategory }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, providerCategory: newUser.providerCategory }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const users = readJSON('users.json');
    const normalizedEmail = email.trim().toLowerCase();
    const user = users.find(u => u.email === normalizedEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, providerCategory: user.providerCategory }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, providerCategory: user.providerCategory }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// GET /api/me
app.get('/api/me', authenticateToken, (req, res) => {
  const users = readJSON('users.json');
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  res.json({ 
    id: user.id, 
    name: user.name, 
    email: user.email, 
    role: user.role, 
    providerCategory: user.providerCategory, 
    profilePicture: user.profilePicture,
    description: user.description,
    createdAt: user.createdAt 
  });
});

// PUT /api/me
app.put('/api/me', authenticateToken, (req, res) => {
  try {
    const { profilePicture, description } = req.body;
    const users = readJSON('users.json');
    const userIndex = users.findIndex(u => u.id === req.user.id);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (profilePicture !== undefined) users[userIndex].profilePicture = profilePicture;
    if (description !== undefined) users[userIndex].description = description;

    writeJSON('users.json', users);

    res.json({
      id: users[userIndex].id,
      name: users[userIndex].name,
      role: users[userIndex].role,
      profilePicture: users[userIndex].profilePicture,
      description: users[userIndex].description
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error updating profile.' });
  }
});

// GET /api/providers
app.get('/api/providers', (req, res) => {
  const users = readJSON('users.json');
  const providers = users
    .filter(u => u.role === 'provider')
    .map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      providerCategory: u.providerCategory,
      profilePicture: u.profilePicture,
      description: u.description,
      createdAt: u.createdAt
    }));
  res.json(providers);
});

// ============================================================
//  JOBS ROUTES
// ============================================================

app.get('/api/jobs', (req, res) => {
  const jobs = readJSON('jobs.json');
  res.json(jobs);
});

app.get('/api/jobs/user', authenticateToken, (req, res) => {
  const jobs = readJSON('jobs.json');
  const userJobs = jobs.filter(j => j.userId === req.user.id);
  res.json(userJobs);
});

app.post('/api/jobs', authenticateToken, (req, res) => {
  try {
    const { title, category, description, budget, location } = req.body;

    if (!title || !category || !description) {
      return res.status(400).json({ error: 'Title, category, and description are required.' });
    }

    const jobs = readJSON('jobs.json');
    const newJob = {
      id: Date.now(),
      title,
      category,
      description,
      budget: budget || '0',
      location: location || 'Not specified',
      userId: req.user.id,
      userEmail: req.user.email,
      date: new Date().toLocaleDateString(),
      createdAt: new Date().toISOString()
    };

    jobs.unshift(newJob);
    writeJSON('jobs.json', jobs);

    res.status(201).json(newJob);
  } catch (err) {
    console.error('Create job error:', err);
    res.status(500).json({ error: 'Server error creating job.' });
  }
});

app.put('/api/jobs/:id', authenticateToken, (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    const jobs = readJSON('jobs.json');
    const jobIndex = jobs.findIndex(j => j.id === jobId);

    if (jobIndex === -1) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    if (jobs[jobIndex].userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own jobs.' });
    }

    const { title, category, description, budget, location } = req.body;
    jobs[jobIndex] = {
      ...jobs[jobIndex],
      title: title || jobs[jobIndex].title,
      category: category || jobs[jobIndex].category,
      description: description || jobs[jobIndex].description,
      budget: budget || jobs[jobIndex].budget,
      location: location || jobs[jobIndex].location,
      updatedAt: new Date().toISOString()
    };

    writeJSON('jobs.json', jobs);
    res.json(jobs[jobIndex]);
  } catch (err) {
    console.error('Update job error:', err);
    res.status(500).json({ error: 'Server error updating job.' });
  }
});

app.delete('/api/jobs/:id', authenticateToken, (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    const jobs = readJSON('jobs.json');
    const job = jobs.find(j => j.id === jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    if (job.userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own jobs.' });
    }

    const filtered = jobs.filter(j => j.id !== jobId);
    writeJSON('jobs.json', filtered);

    res.json({ message: 'Job deleted successfully.' });
  } catch (err) {
    console.error('Delete job error:', err);
    res.status(500).json({ error: 'Server error deleting job.' });
  }
});

// ============================================================
//  SERVICES ROUTES
// ============================================================

app.get('/api/services', (req, res) => {
  const services = readJSON('services.json');
  res.json(services);
});

app.post('/api/services', authenticateToken, (req, res) => {
  try {
    const { businessName, category, location, email, phone, description, servicesOffered } = req.body;

    if (!businessName || !category || !description) {
      return res.status(400).json({ error: 'Business name, category, and description are required.' });
    }

    const services = readJSON('services.json');
    const newService = {
      id: Date.now(),
      businessName,
      category,
      location: location || 'Not specified',
      email: email || req.user.email,
      phone: phone || '',
      description,
      servicesOffered: servicesOffered || '',
      userId: req.user.id,
      userEmail: req.user.email,
      createdAt: new Date().toISOString()
    };

    services.unshift(newService);
    writeJSON('services.json', services);

    res.status(201).json(newService);
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ error: 'Server error creating service.' });
  }
});

app.get('/api/services/user', authenticateToken, (req, res) => {
  const services = readJSON('services.json');
  const userServices = services.filter(s => s.userId === req.user.id);
  res.json(userServices);
});

app.delete('/api/services/:id', authenticateToken, (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    const services = readJSON('services.json');
    const service = services.find(s => s.id === serviceId);

    if (!service) {
      return res.status(404).json({ error: 'Service not found.' });
    }

    if (service.userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own services.' });
    }

    const filtered = services.filter(s => s.id !== serviceId);
    writeJSON('services.json', filtered);

    res.json({ message: 'Service deleted successfully.' });
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({ error: 'Server error deleting service.' });
  }
});

// ============================================================
//  MESSAGE ROUTES
// ============================================================

app.post('/api/messages', authenticateToken, (req, res) => {
  try {
    const { receiverId, content } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({ error: 'Receiver ID and content are required.' });
    }

    const messages = readJSON('messages.json');
    const newMessage = {
      id: Date.now(),
      senderId: req.user.id,
      receiverId: Number(receiverId),
      senderName: req.user.name || 'Anonymous',
      senderEmail: req.user.email || 'Not provided',
      content,
      isRead: false,
      createdAt: new Date().toISOString()
    };

    messages.unshift(newMessage);
    writeJSON('messages.json', messages);

    res.status(201).json({ message: 'Message sent successfully.' });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Server error sending message.' });
  }
});

app.get('/api/messages', authenticateToken, (req, res) => {
  try {
    const messages = readJSON('messages.json');
    const userMessages = messages.filter(m => m.receiverId === req.user.id);
    res.json(userMessages);
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error retrieving messages.' });
  }
});

// ============================================================
//  CONTACT ROUTE
// ============================================================

app.post('/api/contact', (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    const contacts = readJSON('contacts.json');
    const newContact = {
      id: Date.now(),
      name,
      email,
      message,
      createdAt: new Date().toISOString()
    };

    contacts.push(newContact);
    writeJSON('contacts.json', contacts);

    res.status(201).json({ message: 'Message received! We\'ll get back to you soon.' });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ error: 'Server error saving contact message.' });
  }
});

// ============================================================
//  AI ROUTES (OpenAI GPT)
// ============================================================

const SYSTEM_CONTEXT = `You are Linkee AI, a helpful assistant for the Linkee platform — a local service marketplace connecting customers with professionals (plumbers, electricians, carpenters, cleaners, etc.). Be friendly, concise, and helpful. Available service categories: plumbing, electrical, carpentry, cleaning, and other.`;

app.post('/api/ai/chat', async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'AI service not configured.' });
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required.' });

    const messages = [
      { role: 'system', content: SYSTEM_CONTEXT + ' Help users find services, answer questions about Linkee, and guide them through posting jobs or services. Keep responses short (2-3 sentences max unless they ask for detail).' }
    ];

    if (history && Array.isArray(history)) {
      history.slice(-10).forEach(h => {
        messages.push({ role: h.role, content: h.content });
      });
    }
    messages.push({ role: 'user', content: message });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 300,
      temperature: 0.7
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error('AI Chat error:', err.message);
    res.status(500).json({ error: 'AI service unavailable. Please try again.' });
  }
});

app.post('/api/ai/match', async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'AI service not configured.' });
  try {
    const { jobTitle, jobDescription, jobCategory } = req.body;
    if (!jobTitle && !jobDescription) return res.status(400).json({ error: 'Job info required.' });

    const services = readJSON('services.json');
    const serviceList = services.length > 0
      ? services.map(s => `- ${s.businessName} (${s.category}): ${s.description}`).join('\n')
      : 'No user-posted services yet.';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_CONTEXT },
        { role: 'user', content: `A customer posted this job:\nTitle: ${jobTitle}\nCategory: ${jobCategory || 'not specified'}\nDescription: ${jobDescription || 'not provided'}\n\nAvailable services on the platform:\n${serviceList}\n\nSuggest the best matching service categories and provide 2-3 tips for the customer to get the best results. Format your response as JSON with keys: "matchedCategories" (array of strings), "tips" (array of strings), "summary" (string).` }
      ],
      max_tokens: 400,
      temperature: 0.5,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    res.json(result);
  } catch (err) {
    console.error('AI Match error:', err.message);
    res.status(500).json({ error: 'AI service unavailable. Please try again.' });
  }
});

app.post('/api/ai/generate', async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'AI service not configured.' });
  try {
    const { type, title, category, currentDescription, details } = req.body;
    if (!type) return res.status(400).json({ error: 'Type (job or service) is required.' });

    let prompt;
    if (type === 'job') {
      prompt = `Write a clear, professional job posting description for a ${category || 'general'} job titled "${title || 'Untitled'}".${currentDescription ? ` The user wrote: "${currentDescription}". Improve and expand it.` : ''}${details ? ` Additional details: ${details}` : ''} Keep it under 100 words. Be specific about what needs to be done.`;
    } else {
      prompt = `Write a professional service listing description for a ${category || 'general'} business called "${title || 'Untitled'}".${currentDescription ? ` The user wrote: "${currentDescription}". Improve and expand it.` : ''}${details ? ` Additional info: ${details}` : ''} Keep it under 120 words. Highlight expertise, reliability, and value.`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a professional copywriter. Write compelling, clear descriptions. Return ONLY the description text, no quotes or labels.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.7
    });

    res.json({ description: completion.choices[0].message.content.trim() });
  } catch (err) {
    console.error('AI Generate error:', err.message);
    res.status(500).json({ error: 'AI service unavailable. Please try again.' });
  }
});

app.post('/api/ai/search', async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'AI service not configured.' });
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Search query is required.' });

    const services = readJSON('services.json');
    const jobs = readJSON('jobs.json');

    const allItems = [
      ...services.map(s => ({ type: 'service', id: s.id, name: s.businessName, category: s.category, description: s.description })),
      ...jobs.map(j => ({ type: 'job', id: j.id, name: j.title, category: j.category, description: j.description }))
    ];

    const defaultCategories = ['plumbing', 'electrical', 'carpentry', 'cleaning'];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_CONTEXT },
        { role: 'user', content: `User searched: "${query}"\n\nAvailable items on platform:\n${JSON.stringify(allItems)}\n\nDefault categories: ${defaultCategories.join(', ')}\n\nAnalyze the search query and return JSON with: "matchedCategories" (array of matching category strings), "matchedIds" (array of matching item ids), "suggestion" (helpful text for the user about what they might be looking for). If no exact matches, suggest the closest categories.` }
      ],
      max_tokens: 300,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    res.json(result);
  } catch (err) {
    console.error('AI Search error:', err.message);
    res.status(500).json({ error: 'AI service unavailable. Please try again.' });
  }
});

// ============================================================
//  EXPORT FOR VERCEL (no app.listen!)
// ============================================================
module.exports = app;
