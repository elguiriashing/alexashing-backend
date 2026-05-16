// Complete Backend for Alex Ashing Portfolio
// Run with: npm install && npm start

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware
app.use(cors());
app.use(express.json());

// Admin Auth Middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== '!Magnetix1!') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
// Note: Static serving removed - frontend deployed separately

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ Connected to MongoDB Atlas');
}).catch(err => console.error('❌ MongoDB connection error:', err));

// MongoDB Schemas
const messageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  project_type: String,
  message: { type: String, required: true },
  source: String,
  status: { type: String, default: 'new' }, // new, responded, archived
  createdAt: { type: Date, default: Date.now },
  respondedAt: Date
});

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  venue: String,
  type: String,
  status: { type: String, default: 'pending' }, // pending, confirmed, cancelled
  description: String,
  createdAt: { type: Date, default: Date.now }
});

const portfolioSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: String, // photography, video, vj, music, tech
  category: String, // music, visuals, tech
  imageUrl: String,
  cloudinaryPublicId: String,
  description: String,
  featured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);
const Event = mongoose.model('Event', eventSchema);
const Portfolio = mongoose.model('Portfolio', portfolioSchema);

// Configure Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// API Routes

// Contact Form Submission
app.post('/api/contact', async (req, res) => {
  try {
    const message = new Message(req.body);
    await message.save();
    console.log('✅ New contact form submission:', req.body);
    res.json({ success: true, message: 'Contact form submitted successfully' });
  } catch (error) {
    console.error('❌ Contact form error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Messages for Admin
app.get('/api/messages', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Message Status
app.put('/api/messages/:id', authMiddleware, async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { ...req.body, respondedAt: Date.now() },
      { new: true }
    );
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Message
app.delete('/api/messages/:id', authMiddleware, async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Events Management
app.get('/api/events', async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/events', authMiddleware, async (req, res) => {
  try {
    const event = new Event(req.body);
    await event.save();
    console.log('✅ New event created:', event);
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/events/:id', authMiddleware, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/events/:id', authMiddleware, async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Portfolio Management
app.get('/api/portfolio', async (req, res) => {
  try {
    const portfolio = await Portfolio.find().sort({ createdAt: -1 });
    res.json(portfolio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload Portfolio Item with Cloudinary
app.post('/api/portfolio', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    // Upload to Cloudinary
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        folder: 'portfolio',
        transformation: [
          { width: 1200, height: 800, crop: 'fit', quality: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          return res.status(500).json({ error: 'Cloudinary upload failed' });
        }
        
        // Save to database
        const portfolio = new Portfolio({
          title: req.body.title,
          type: req.body.type,
          category: req.body.category,
          description: req.body.description,
          featured: req.body.featured === 'true',
          imageUrl: result.secure_url,
          cloudinaryPublicId: result.public_id
        });
        
        portfolio.save().then(saved => {
          console.log('✅ New portfolio item saved:', saved);
          res.json(saved);
        }).catch(dbError => {
          res.status(500).json({ error: dbError.message });
        });
      }
    ).end(req.file.buffer);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/portfolio/:id', authMiddleware, async (req, res) => {
  try {
    const portfolio = await Portfolio.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(portfolio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/portfolio/:id', authMiddleware, async (req, res) => {
  try {
    const item = await Portfolio.findByIdAndDelete(req.params.id);
    if (item && item.cloudinaryPublicId) {
      // Delete from Cloudinary
      cloudinary.uploader.destroy(item.cloudinaryPublicId, (error, result) => {
        if (error) {
          console.error('Cloudinary delete error:', error);
        }
      });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Outreach Scraping Endpoint
app.post('/api/outreach/scrape', authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    
    // Add http:// if missing
    let targetUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      targetUrl = 'https://' + url;
    }

    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000 // 10 second timeout
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Scrape emails
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
    const rawEmails = html.match(emailRegex) || [];
    const emails = [...new Set(rawEmails)].filter(e => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.webp'));
    
    // Scrape basic phone numbers
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const rawPhones = html.match(phoneRegex) || [];
    const phones = [...new Set(rawPhones)].filter(p => p.length >= 10);
    
    // Extract title and description
    const title = $('title').text().trim() || '';
    const description = $('meta[name="description"]').attr('content') || '';
    
    // Extract social links
    const socialLinks = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && (href.includes('instagram.com') || href.includes('linkedin.com') || href.includes('twitter.com') || href.includes('facebook.com'))) {
        socialLinks.push(href);
      }
    });
    const uniqueSocials = [...new Set(socialLinks)];

    res.json({
      success: true,
      data: {
        url: targetUrl,
        title,
        description,
        emails,
        phones,
        socials: uniqueSocials
      }
    });
  } catch (error) {
    console.error('Scrape error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to scrape URL. ' + error.message });
  }
});

// Email Sending Endpoint
app.post('/api/email/send', authMiddleware, async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    if (!to || !subject || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Configure nodemailer with Gmail or standard SMTP
    // You'll need to set SMTP_USER and SMTP_PASS in your .env
    const transporter = nodemailer.createTransport({
      service: 'gmail', // Fallback to gmail for simplicity if custom SMTP isn't setup
      auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASS || 'your-app-password'
      }
    });

    const mailOptions = {
      from: process.env.SMTP_USER || 'your-email@gmail.com',
      to,
      subject,
      text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.response);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('❌ Email send error:', error);
    res.status(500).json({ success: false, error: 'Failed to send email. ' + error.message });
  }
});

// Serve static files (your HTML pages)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Visit: http://localhost:${PORT}`);
  console.log(`📧 EmailJS configured for contact forms`);
  console.log(`☁️ Cloudinary configured for image uploads`);
  console.log(`🗄️ MongoDB Atlas connected successfully`);
});
