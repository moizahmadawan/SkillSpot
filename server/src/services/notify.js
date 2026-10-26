import Notification from '../models/Notification.js';
// Saves a notification and pushes it live to the user's socket room.
export async function notify(app, userId, { type, title, body = '', link = '' }) {
  const n = await Notification.create({ user: userId, type, title, body, link });
  app.get('io')?.to(`user:${userId}`).emit('notification', { _id: String(n._id), type, title, body, link, read: false, createdAt: n.createdAt });
  return n;
}
