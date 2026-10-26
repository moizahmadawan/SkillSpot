# SkillSpot AI — Smart Micro-Gig & Local Skill Finder

React + TS + Tailwind · Express · MongoDB Atlas · Firebase Phone OTP · Socket.IO · LLM matching

## Quick start
```bash
# 1) Server
cd server && cp .env.example .env     # MONGODB_URI (Atlas) aur JWT_SECRET bharein
npm install && npm run seed && npm run dev

# 2) Client (naye terminal mein)
cd client && cp .env.example .env
npm install && npm run dev            # http://localhost:5173

# 3) Admin panel (alag app, naye terminal mein)
cd admin && npm install && npm run dev   # http://localhost:5174
```
Folders: `server/` (API), `client/` (users ka app), `admin/` (admin panel). Teeno alag chalte hain; admin aur client dono `/api` par server se baat karte hain.
Deploy par server ke `CLIENT_URL` mein dono URLs comma se alag karke dalein (client, admin).
Bina Firebase ke test: login par `+923000000001` aur OTP `123456` (DEV_AUTH=true).
Admin login: `admin/` app mein `/login` par `ADMIN_EMAIL` + password (`npm run set-admin-password` in server).

## Atlas setup
Atlas > Database > Connect > Drivers > string copy karke `MONGODB_URI` mein dalein. Network Access mein apna IP allow karein.

## Firebase Phone OTP
1. Firebase Console > Authentication > Sign-in method > **Phone** enable.
2. Project settings > Your apps > Web app: config values `client/.env` (VITE_FIREBASE_*) mein.
3. Authentication > Settings > Authorized domains mein apna domain add karein.
4. Project settings > Service accounts > *Generate new private key*; JSON ek line mein `FIREBASE_SERVICE_ACCOUNT` mein, aur `DEV_AUTH=false` karein.
Testing ke liye Firebase Console mein test phone numbers add kar sakte hain.

## AI
`ANTHROPIC_API_KEY` set karein (model `AI_MODEL`). Key na ho to rule-based fallback chalta hai, app phir bhi kaam karti hai.
- `services/matching.js`: score = skills 45 + location 20 + budget 15 + experience 10 + rating 10 (busy users ×0.6). LLM sirf "kyun fit hai" explain karta hai.
- `services/safety.js`: regex rules + optional LLM; flagged gigs `pending_review` mein jaate hain, admin approve/reject karta hai.

## Deploy
Server: Render/Railway (env vars set karein). Client: `npm run build`, Vercel/Netlify; `/api` aur `/socket.io` ko server par proxy/rewrite karein.

## Production se pehle
Real payments/escrow, image uploads, reviews moderation, rate limits per user, aur Terms/Privacy pages add karein.
