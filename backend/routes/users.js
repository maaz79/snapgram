const express = require('express');
const router = express.Router();
const { DB } = require('../database');
const { authenticateToken } = require('../middleware/auth');

function safeUser(u, currentUserId) {
  if (!u) return null;
  const { password, ...safe } = u;
  return { ...safe, followers_count: DB.getFollowersCount(u.id), following_count: DB.getFollowingCount(u.id), posts_count: DB.getPostsByUserId(u.id).length, is_following: currentUserId ? DB.isFollowing(currentUserId, u.id) : false };
}

router.get('/search', authenticateToken, (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ users: [] });
  const users = DB.searchUsers(q, req.user.id).map(u => safeUser(u, req.user.id));
  res.json({ users });
});

router.get('/suggestions/all', authenticateToken, (req, res) => {
  const following = DB.getFollowing(req.user.id);
  const users = DB.getAllUsers()
    .filter(u => u.id !== req.user.id && !following.includes(u.id))
    .map(u => safeUser(u, req.user.id))
    .sort((a, b) => b.followers_count - a.followers_count)
    .slice(0, 5);
  res.json({ users });
});

router.get('/notifications/all', authenticateToken, (req, res) => {
  const notifs = DB.getNotifications(req.user.id).map(n => {
    const from = DB.findUserById(n.from_user_id) || {};
    const post = n.post_id ? DB.findPostById(n.post_id) : null;
    return { ...n, from_username: from.username, from_avatar: from.avatar, from_fullname: from.fullname, post_emoji: post?.emoji, post_caption: post?.caption };
  });
  res.json({ notifications: notifs, unread: DB.getUnreadNotifsCount(req.user.id) });
});

router.put('/notifications/read', authenticateToken, (req, res) => {
  DB.markNotifsRead(req.user.id);
  res.json({ message: 'Marked read' });
});

router.get('/messages/conversations', authenticateToken, (req, res) => {
  const convos = DB.getConversations(req.user.id).map(c => {
    const u = DB.findUserById(c.other_user_id);
    const { password, ...safeU } = u || {};
    return { ...c, user: safeU };
  });
  res.json({ conversations: convos });
});

router.get('/messages/:username', authenticateToken, (req, res) => {
  const other = DB.findUserByUsername(req.params.username);
  if (!other) return res.status(404).json({ error: 'User not found' });
  const msgs = DB.getConversation(req.user.id, other.id).map(m => {
    const sender = DB.findUserById(m.sender_id) || {};
    return { ...m, sender_username: sender.username, sender_avatar: sender.avatar };
  });
  DB.markRead(other.id, req.user.id);
  const { password, ...safeOther } = other;
  res.json({ messages: msgs, otherUser: safeOther });
});

router.post('/messages/:username', authenticateToken, (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Message cannot be empty' });
  const other = DB.findUserByUsername(req.params.username);
  if (!other) return res.status(404).json({ error: 'User not found' });
  const msg = DB.sendMessage({ sender_id: req.user.id, receiver_id: other.id, text: text.trim() });
  const u = DB.findUserById(req.user.id);
  res.status(201).json({ message: { ...msg, sender_username: u.username, sender_avatar: u.avatar } });
});

router.get('/:username', authenticateToken, (req, res) => {
  const u = DB.findUserByUsername(req.params.username);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const posts = DB.getPostsByUserId(u.id).map(p => ({
    ...p, likes_count: DB.getLikesCount(p.id), comments_count: DB.getCommentsCount(p.id)
  }));
  res.json({ user: safeUser(u, req.user.id), posts });
});

router.post('/:username/follow', authenticateToken, (req, res) => {
  const target = DB.findUserByUsername(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });
  const following = DB.toggleFollow(req.user.id, target.id);
  if (following) DB.addNotification({ user_id: target.id, from_user_id: req.user.id, type: 'follow' });
  res.json({ following, followers_count: DB.getFollowersCount(target.id) });
});

module.exports = router;