import express, { Router } from 'express';
import { config } from '../config';
import { loginHandler, logoutHandler, meHandler, registerHandler, siweNonceHandler, siweVerifyHandler } from '../controllers/authController';
import { gameDataHandler } from '../controllers/gameDataController';
import { getProfile, patchProfile } from '../controllers/profileController';
import {
  deleteWorldHandler,
  getInventoryHandler,
  getWorldHandler,
  listWorldsHandler,
  putWorldHandler,
} from '../controllers/worldController';
import { addFriendHandler, listFriendsHandler, lobbiesHandler, openWorldHandler, removeFriendHandler } from '../controllers/socialController';
import { isDatabaseReady } from '../database/db';
import { requireDatabase } from './errors';
import { rateLimit, requireUser } from './middleware';

export const api = Router();

api.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'farming-backend', database: isDatabaseReady(), time: new Date().toISOString() });
});

api.get('/game-data', gameDataHandler);

// Accounts
const authLimit = rateLimit(10, 60_000);
api.post('/auth/register', authLimit, requireDatabase, express.json(), registerHandler);
api.post('/auth/login', authLimit, requireDatabase, express.json(), loginHandler);
api.post('/auth/logout', requireDatabase, logoutHandler);
api.get('/auth/siwe/nonce', rateLimit(40, 60_000), requireDatabase, siweNonceHandler);
api.post('/auth/siwe/verify', authLimit, requireDatabase, express.json(), siweVerifyHandler);
api.get('/auth/me', meHandler);

// Profile
api.get('/profile', requireDatabase, requireUser, getProfile);
api.patch('/profile', requireDatabase, requireUser, express.json(), patchProfile);

// Saved worlds (one per seed) and their inventories
api.get('/worlds', requireDatabase, requireUser, listWorldsHandler);
api.get('/worlds/:seed', requireDatabase, requireUser, getWorldHandler);
api.put('/worlds/:seed', requireDatabase, requireUser, express.json({ limit: config.maxSaveBytes }), putWorldHandler);
api.delete('/worlds/:seed', requireDatabase, requireUser, deleteWorldHandler);
api.get('/worlds/:seed/inventory', requireDatabase, requireUser, getInventoryHandler);

// Friends and the public game browser
api.get('/friends', requireDatabase, requireUser, listFriendsHandler);
api.post('/friends', requireDatabase, requireUser, rateLimit(20, 60_000), express.json(), addFriendHandler);
api.delete('/friends/:username', requireDatabase, requireUser, removeFriendHandler);
api.get('/lobbies', lobbiesHandler);
api.get('/openworld', openWorldHandler);
