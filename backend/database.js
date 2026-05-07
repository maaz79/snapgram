// database.js — LowDB Database (Pure JS, no build tools needed)
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const bcrypt = require('bcryptjs');

const adapter = new FileSync(path.join(__dirname, 'snapgram_db.json'));
const db = low(adapter);

db.defaults({
  users: [], posts: [], likes: [], comments: [],
  follows: [], messages: [], notifications: [], saved_posts: [],
  _nextId: { users: 1, posts: 1, likes: 1, comments: 1, follows: 1, messages: 1, notifications: 1, saved: 1 }
}).write();

function nextId(table) {
  const id = db.get('_nextId.' + table).value();
  db.set('_nextId.' + table, id + 1).write();
  return id;
}

if (db.get('users').value().length === 0) {
  const hash = bcrypt.hashSync('Admin@1234!', 12);
  const now = new Date().toISOString();
  db.set('users', [
    { id:1, username:'travel_maria', email:'maria@snapgram.com', fullname:'Maria Gonzalez', password:hash, avatar:'🌸', bio:'✈️ Explorer | 47 countries', website:'', is_verified:1, created_at:now },
    { id:2, username:'foodie_chef', email:'chef@snapgram.com', fullname:'Ahmed Raza', password:hash, avatar:'👨‍🍳', bio:'🍳 Executive Chef', website:'', is_verified:1, created_at:now },
    { id:3, username:'fitness_pro', email:'sara@snapgram.com', fullname:'Sara Williams', password:hash, avatar:'💪', bio:'🏋️ Personal Trainer', website:'', is_verified:0, created_at:now },
    { id:4, username:'art_by_alex', email:'alex@snapgram.com', fullname:'Alex Chen', password:hash, avatar:'🎨', bio:'🖌️ Digital Artist', website:'', is_verified:1, created_at:now },
    { id:5, username:'nature_shots', email:'nature@snapgram.com', fullname:'Liam Park', password:hash, avatar:'🌿', bio:'📸 Wildlife Photographer', website:'', is_verified:0, created_at:now },
  ]).write();
  db.set('posts', [
    { id:1, user_id:1, caption:'Golden hour in Santorini 🌅', emoji:'🌅', location:'Santorini, Greece', created_at:now },
    { id:2, user_id:1, caption:'Hidden gem in Tuscany 🍷', emoji:'🍷', location:'Tuscany, Italy', created_at:now },
    { id:3, user_id:2, caption:'My signature truffle pasta 🍝', emoji:'🍝', location:'Milan, Italy', created_at:now },
    { id:4, user_id:2, caption:'Street food tour Bangkok 🌶️', emoji:'🌶️', location:'Bangkok, Thailand', created_at:now },
    { id:5, user_id:3, caption:'Day 100 transformation 💪', emoji:'💪', location:'New York, USA', created_at:now },
    { id:6, user_id:4, caption:'Electric Dreams artwork ⚡', emoji:'⚡', location:'Tokyo, Japan', created_at:now },
    { id:7, user_id:5, caption:'Majestic eagle at sunrise 🦅', emoji:'🦅', location:'Alaska, USA', created_at:now },
    { id:8, user_id:5, caption:'Northern Lights finally! 🌌', emoji:'🌌', location:'Tromsø, Norway', created_at:now },
  ]).write();
  db.set('follows', [
    { id:1, follower_id:1, following_id:2, created_at:now },
    { id:2, follower_id:1, following_id:3, created_at:now },
    { id:3, follower_id:2, following_id:1, created_at:now },
    { id:4, follower_id:3, following_id:1, created_at:now },
    { id:5, follower_id:4, following_id:1, created_at:now },
  ]).write();
  db.set('likes', [
    { id:1, user_id:2, post_id:1, created_at:now },
    { id:2, user_id:3, post_id:1, created_at:now },
    { id:3, user_id:1, post_id:3, created_at:now },
  ]).write();
  db.set('comments', [
    { id:1, user_id:2, post_id:1, text:'Absolutely breathtaking! 😍', created_at:now },
    { id:2, user_id:3, post_id:1, text:'The colors are unreal!', created_at:now },
  ]).write();
  db.set('_nextId', { users:6, posts:9, likes:4, comments:3, follows:6, messages:1, notifications:1, saved:1 }).write();
  console.log('✅ Database seeded!');
}

const DB = {
  findUserById: (id) => db.get('users').find({ id: Number(id) }).value(),
  findUserByUsername: (username) => db.get('users').find(u => u.username.toLowerCase() === username.toLowerCase()).value(),
  findUserByEmail: (email) => db.get('users').find(u => u.email.toLowerCase() === email.toLowerCase()).value(),
  findUserByIdentifier: (id) => { const l = id.toLowerCase(); return db.get('users').find(u => u.username.toLowerCase()===l||u.email.toLowerCase()===l).value(); },
  createUser: (data) => { const id=nextId('users'); const user={id,...data,created_at:new Date().toISOString()}; db.get('users').push(user).write(); return user; },
  updateUser: (id, data) => { db.get('users').find({id:Number(id)}).assign({...data,updated_at:new Date().toISOString()}).write(); return DB.findUserById(id); },
  getAllUsers: () => db.get('users').value(),
  searchUsers: (q, excludeId) => { const l=q.toLowerCase(); return db.get('users').filter(u=>u.id!==excludeId&&(u.username.toLowerCase().includes(l)||u.fullname.toLowerCase().includes(l))).value(); },
  findPostById: (id) => db.get('posts').find({ id: Number(id) }).value(),
  createPost: (data) => { const id=nextId('posts'); const post={id,...data,created_at:new Date().toISOString()}; db.get('posts').push(post).write(); return post; },
  updatePost: (id, data) => { db.get('posts').find({id:Number(id)}).assign(data).write(); return DB.findPostById(id); },
  deletePost: (id) => { db.get('posts').remove({id:Number(id)}).write(); db.get('likes').remove({post_id:Number(id)}).write(); db.get('comments').remove({post_id:Number(id)}).write(); db.get('saved_posts').remove({post_id:Number(id)}).write(); },
  getPostsByUserId: (userId) => db.get('posts').filter({user_id:Number(userId)}).sortBy(p=>-new Date(p.created_at)).value(),
  getAllPosts: () => db.get('posts').sortBy(p=>-new Date(p.created_at)).value(),
  getFeedPosts: (userId, followingIds) => { const ids=[Number(userId),...followingIds.map(Number)]; return db.get('posts').filter(p=>ids.includes(p.user_id)).sortBy(p=>-new Date(p.created_at)).value(); },
  isLiked: (userId, postId) => !!db.get('likes').find({user_id:Number(userId),post_id:Number(postId)}).value(),
  getLikesCount: (postId) => db.get('likes').filter({post_id:Number(postId)}).value().length,
  toggleLike: (userId, postId) => { const e=db.get('likes').find({user_id:Number(userId),post_id:Number(postId)}).value(); if(e){db.get('likes').remove({user_id:Number(userId),post_id:Number(postId)}).write();return false;}else{db.get('likes').push({id:nextId('likes'),user_id:Number(userId),post_id:Number(postId),created_at:new Date().toISOString()}).write();return true;} },
  isSaved: (userId, postId) => !!db.get('saved_posts').find({user_id:Number(userId),post_id:Number(postId)}).value(),
  toggleSave: (userId, postId) => { const e=db.get('saved_posts').find({user_id:Number(userId),post_id:Number(postId)}).value(); if(e){db.get('saved_posts').remove({user_id:Number(userId),post_id:Number(postId)}).write();return false;}else{db.get('saved_posts').push({id:nextId('saved'),user_id:Number(userId),post_id:Number(postId),created_at:new Date().toISOString()}).write();return true;} },
  getSavedPosts: (userId) => { const s=db.get('saved_posts').filter({user_id:Number(userId)}).value(); return s.map(x=>DB.findPostById(x.post_id)).filter(Boolean); },
  getComments: (postId) => db.get('comments').filter({post_id:Number(postId)}).value(),
  getCommentsCount: (postId) => db.get('comments').filter({post_id:Number(postId)}).value().length,
  addComment: (data) => { const id=nextId('comments'); const c={id,...data,created_at:new Date().toISOString()}; db.get('comments').push(c).write(); return c; },
  deleteComment: (id) => db.get('comments').remove({id:Number(id)}).write(),
  findCommentById: (id) => db.get('comments').find({id:Number(id)}).value(),
  isFollowing: (ferId, fgId) => !!db.get('follows').find({follower_id:Number(ferId),following_id:Number(fgId)}).value(),
  getFollowing: (userId) => db.get('follows').filter({follower_id:Number(userId)}).map('following_id').value(),
  getFollowersCount: (userId) => db.get('follows').filter({following_id:Number(userId)}).value().length,
  getFollowingCount: (userId) => db.get('follows').filter({follower_id:Number(userId)}).value().length,
  toggleFollow: (ferId, fgId) => { const e=db.get('follows').find({follower_id:Number(ferId),following_id:Number(fgId)}).value(); if(e){db.get('follows').remove({follower_id:Number(ferId),following_id:Number(fgId)}).write();return false;}else{db.get('follows').push({id:nextId('follows'),follower_id:Number(ferId),following_id:Number(fgId),created_at:new Date().toISOString()}).write();return true;} },
  getConversation: (uA, uB) => db.get('messages').filter(m=>(m.sender_id===Number(uA)&&m.receiver_id===Number(uB))||(m.sender_id===Number(uB)&&m.receiver_id===Number(uA))).sortBy('created_at').value(),
  sendMessage: (data) => { const id=nextId('messages'); const m={id,...data,is_read:0,created_at:new Date().toISOString()}; db.get('messages').push(m).write(); return m; },
  getConversations: (userId) => { const msgs=db.get('messages').filter(m=>m.sender_id===Number(userId)||m.receiver_id===Number(userId)).value(); const p={}; msgs.forEach(m=>{const o=m.sender_id===Number(userId)?m.receiver_id:m.sender_id;if(!p[o]||new Date(m.created_at)>new Date(p[o].created_at))p[o]=m;}); return Object.entries(p).map(([uid,lm])=>({other_user_id:Number(uid),last_message:lm.text,last_at:lm.created_at,unread_count:db.get('messages').filter(m=>m.sender_id===Number(uid)&&m.receiver_id===Number(userId)&&!m.is_read).value().length})).sort((a,b)=>new Date(b.last_at)-new Date(a.last_at)); },
  markRead: (sId, rId) => { db.get('messages').filter({sender_id:Number(sId),receiver_id:Number(rId)}).each(m=>{m.is_read=1;}).write(); },
  addNotification: (data) => { db.get('notifications').push({id:nextId('notifications'),...data,is_read:0,created_at:new Date().toISOString()}).write(); },
  getNotifications: (userId) => db.get('notifications').filter({user_id:Number(userId)}).sortBy(n=>-new Date(n.created_at)).value().slice(0,50),
  markNotifsRead: (userId) => { db.get('notifications').filter({user_id:Number(userId)}).each(n=>{n.is_read=1;}).write(); },
  getUnreadNotifsCount: (userId) => db.get('notifications').filter({user_id:Number(userId),is_read:0}).value().length,
};

module.exports = { db, DB };