const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { DB } = require('../database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

function validatePassword(pw) {
  const e = [];
  if (pw.length < 8) e.push('At least 8 characters');
  if (!/[A-Z]/.test(pw)) e.push('At least one uppercase letter');
  if (!/[a-z]/.test(pw)) e.push('At least one lowercase letter');
  if (!/[0-9]/.test(pw)) e.push('At least one number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) e.push('At least one special character');
  if (pw.length > 128) e.push('Maximum 128 characters');
  return e;
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, fullname, password, avatar, bio } = req.body;
    if (!username || !email || !fullname || !password) return res.status(400).json({ error: 'All fields are required' });
    if (!/^[a-zA-Z0-9._]{3,30}$/.test(username)) return res.status(400).json({ error: 'Username: 3-30 chars, letters/numbers/dots only' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' });
    const pwErrors = validatePassword(password);
    if (pwErrors.length > 0) return res.status(400).json({ error: 'Password requirements not met', requirements: pwErrors });
    if (DB.findUserByUsername(username)) return res.status(409).json({ error: 'Username already taken' });
    if (DB.findUserByEmail(email)) return res.status(409).json({ error: 'Email already registered' });
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = DB.createUser({ username: username.toLowerCase(), email: email.toLowerCase(), fullname, password: hashedPassword, avatar: avatar || '😊', bio: bio || '', website: '', is_verified: 0 });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    const { password: _, ...safeUser } = user;
    res.status(201).json({ token, user: safeUser, message: 'Account created!' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'All fields required' });
    const user = DB.findUserByIdentifier(identifier);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser, message: 'Login successful!' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/me', authenticateToken, (req, res) => {
  const { password, ...safeUser } = req.user;
  res.json({ ...safeUser, postsCount: DB.getPostsByUserId(req.user.id).length, followersCount: DB.getFollowersCount(req.user.id), followingCount: DB.getFollowingCount(req.user.id) });
});

router.put('/profile', authenticateToken, (req, res) => {
  try {
    const { fullname, bio, website, avatar } = req.body;
    const updated = DB.updateUser(req.user.id, { fullname: fullname || req.user.fullname, bio: bio !== undefined ? bio : req.user.bio, website: website || '', avatar: avatar || req.user.avatar });
    const { password: _, ...safeUser } = updated;
    res.json({ user: safeUser, message: 'Profile updated!' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const isValid = await bcrypt.compare(currentPassword, req.user.password);
    if (!isValid) return res.status(401).json({ error: 'Current password incorrect' });
    const pwErrors = validatePassword(newPassword);
    if (pwErrors.length > 0) return res.status(400).json({ error: 'Password requirements not met', requirements: pwErrors });
    DB.updateUser(req.user.id, { password: await bcrypt.hash(newPassword, 12) });
    res.json({ message: 'Password changed!' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;