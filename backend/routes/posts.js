const express = require('express');
const router = express.Router();
const { DB } = require('../database');
const { authenticateToken } = require('../middleware/auth');

function enrichPost(p, currentUserId) {
  if (!p) return null;
  const author = DB.findUserById(p.user_id) || {};
  return {
    ...p,
    username: author.username, fullname: author.fullname,
    avatar: author.avatar, is_verified: author.is_verified,
    likes_count: DB.getLikesCount(p.id),
    comments_count: DB.getCommentsCount(p.id),
    is_liked: currentUserId ? DB.isLiked(currentUserId, p.id) : false,
    is_saved: currentUserId ? DB.isSaved(currentUserId, p.id) : false,
  };
}

router.get('/feed', authenticateToken, (req, res) => {
  const followingIds = DB.getFollowing(req.user.id);
  const posts = DB.getFeedPosts(req.user.id, followingIds).map(p => enrichPost(p, req.user.id));
  res.json({ posts });
});

router.get('/explore', authenticateToken, (req, res) => {
  const posts = DB.getAllPosts().map(p => enrichPost(p, req.user.id))
    .sort((a, b) => b.likes_count - a.likes_count);
  res.json({ posts });
});

router.get('/saved/all', authenticateToken, (req, res) => {
  const posts = DB.getSavedPosts(req.user.id).map(p => enrichPost(p, req.user.id));
  res.json({ posts });
});

router.post('/', authenticateToken, (req, res) => {
  const { caption, emoji, location } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Please select an emoji' });
  const post = DB.createPost({ user_id: req.user.id, caption: caption || '', emoji, location: location || '' });
  const followers = DB.getFollowing(req.user.id);
  followers.forEach(fId => DB.addNotification({ user_id: fId, from_user_id: req.user.id, type: 'post', post_id: post.id }));
  res.status(201).json({ post: enrichPost(post, req.user.id) });
});

router.get('/:id', authenticateToken, (req, res) => {
  const post = DB.findPostById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json({ post: enrichPost(post, req.user.id) });
});

router.put('/:id', authenticateToken, (req, res) => {
  const post = DB.findPostById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
  const { caption, location } = req.body;
  const updated = DB.updatePost(req.params.id, { caption, location: location || '' });
  res.json({ post: enrichPost(updated, req.user.id) });
});

router.delete('/:id', authenticateToken, (req, res) => {
  const post = DB.findPostById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
  DB.deletePost(req.params.id);
  res.json({ message: 'Post deleted' });
});

router.post('/:id/like', authenticateToken, (req, res) => {
  const post = DB.findPostById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const liked = DB.toggleLike(req.user.id, req.params.id);
  if (liked && post.user_id !== req.user.id)
    DB.addNotification({ user_id: post.user_id, from_user_id: req.user.id, type: 'like', post_id: post.id });
  res.json({ liked, likes_count: DB.getLikesCount(req.params.id) });
});

router.post('/:id/save', authenticateToken, (req, res) => {
  DB.findPostById(req.params.id) || res.status(404).json({ error: 'Not found' });
  const saved = DB.toggleSave(req.user.id, req.params.id);
  res.json({ saved });
});

router.get('/:id/comments', authenticateToken, (req, res) => {
  const comments = DB.getComments(req.params.id).map(c => {
    const u = DB.findUserById(c.user_id) || {};
    return { ...c, username: u.username, avatar: u.avatar, is_verified: u.is_verified };
  });
  res.json({ comments });
});

router.post('/:id/comments', authenticateToken, (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
  const post = DB.findPostById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const comment = DB.addComment({ user_id: req.user.id, post_id: Number(req.params.id), text: text.trim() });
  if (post.user_id !== req.user.id)
    DB.addNotification({ user_id: post.user_id, from_user_id: req.user.id, type: 'comment', post_id: post.id });
  const u = DB.findUserById(req.user.id);
  res.status(201).json({ comment: { ...comment, username: u.username, avatar: u.avatar, is_verified: u.is_verified } });
});

router.delete('/:postId/comments/:commentId', authenticateToken, (req, res) => {
  const comment = DB.findCommentById(req.params.commentId);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  const post = DB.findPostById(req.params.postId);
  if (comment.user_id !== req.user.id && post.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
  DB.deleteComment(req.params.commentId);
  res.json({ message: 'Comment deleted' });
});

module.exports = router;