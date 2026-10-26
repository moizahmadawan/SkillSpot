# SkillSpot AI — Smart Micro-Gig & Local Skill Finder

Apne shehar ke freelancers (electrician, tutor, designer, developer…) ko dhoondne aur hire karne ka marketplace. **Client** kaam post karta hai ya freelancer hire karta hai, **Freelancer** kaam leta hai aur paise kamata hai, aur **Admin** poore platform ko safe rakhta hai.

**Tech:** React + TypeScript + Tailwind · Express · MongoDB Atlas · Firebase Phone OTP · Socket.IO · AI matching (Claude)

---

## 1. Project ka structure

```
skillspot-ai/
├── server/   API (Express + MongoDB + Socket.IO), port 5000
├── client/   Users ka app (client + freelancer), port 5173
└── admin/    Admin panel (alag app), port 5174
```

Teeno alag chalte hain. `client` aur `admin` dono `/api` par ek hi `server` se baat karte hain.

| App | Kaun use karta hai | Login kaise |
|---|---|---|
| `client/` | Client aur Freelancer | Phone number + OTP |
| `admin/` | Sirf Admin | Email + password |
| `server/` | Dono apps ka backend | — |

---

## 2. Setup (pehli baar)

### Zaroori cheezein
- Node.js 18+
- MongoDB Atlas account (free chalega)
- Firebase project (sirf real SMS OTP ke liye; testing ke baghair bhi chalta hai)

### Step 1: Server
```bash
cd server
cp .env.example .env      # agar .env pehle se hai to ye skip karein
npm install
npm run dev
```

`server/.env` mein ye bharein:

| Variable | Kya hai |
|---|---|
| `MONGODB_URI` | Atlas > Database > Connect > Drivers se string. Network Access mein apna IP allow karein. |
| `JWT_SECRET` | Koi lamba random text (kam az kam 32 characters). |
| `CLIENT_URL` | Client aur admin ke URLs, comma se alag: `http://localhost:5173,http://localhost:5174` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin ka email aur password (kam az kam 8 characters). |
| `ALLOW_TEST_OTP` | `true` = koi bhi phone + OTP `123456` (sirf testing). Live par **false**. |
| `FIREBASE_SERVICE_ACCOUNT_FILE` | `./firebase-service-account.json` (neeche dekhein). |
| `ANTHROPIC_API_KEY` | Optional. Na ho to rule-based AI chalta hai. |
| `COMMISSION_RATE` / `TAX_RATE` | Default `0.10` aur `0.05`. |

Pehli baar server chalne par console mein `Admin login ready: <email>` likha aana chahiye.

Admin password baad mein badalna ho to:
```bash
cd server && npm run set-admin-password
```

### Step 2: Client
```bash
cd client
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

### Step 3: Admin
```bash
cd admin
npm install
npm run dev               # http://localhost:5174
```
Login page: `http://localhost:5174/login`

### Firebase Phone OTP (real SMS)
1. Firebase Console > Authentication > Sign-in method > **Phone** ko enable karein.
2. Project settings > Your apps > **Web app** banayein. Ye 4 values `client/.env` mein daalein:
   ```env
   VITE_USE_FIREBASE=true
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
3. Project settings > **Service accounts** > *Generate new private key*. Download hui JSON ko `server/firebase-service-account.json` naam se rakhein. **Ye secret hai, git par push na karein.**
4. Authentication > Settings > **Authorized domains** mein apna domain add karein.
5. `server/.env` mein `ALLOW_TEST_OTP=false` karein.
6. Dono (server aur client) restart karein.

Testing ke liye Firebase Console mein *test phone numbers* bhi add kar sakte hain (SMS kharch nahi hota).

### Bina Firebase ke test
`client/.env` mein `VITE_USE_FIREBASE=false` aur server mein `ALLOW_TEST_OTP=true` rakhein. Login par koi bhi number likhein aur OTP `123456` daalein.

---

## 3. Platform kaise kaam karta hai (ek nazar mein)

```
Login (phone OTP)
   ↓
Account banayein: Client ya Freelancer chunein (baad mein badla nahi ja sakta)
   ↓
Location do + shehar likhein  →  Account "Waiting for approval"
   ↓
Admin location check karke Approve karta hai
   ↓
Ab post / hire / chat / pay sab chalta hai
```

> **Zaroori:** Jab tak admin approve na kare, aap sirf browse kar sakte hain. Gig post karna, hire karna, apply karna, message aur payment sab band rehta hai.

---

## 4. Client ke liye guide

![Client guide](docs/client.png)

Client wo hai jisay kaam karwana hai (ghar ka kaam, tuition, design, website…).

### 4.1 Account banana
1. `http://localhost:5173` kholein, **Log in** dabayein.
2. Phone number daalein (`03001234567` ya `+923001234567`), OTP likhein.
3. **Set up your account** par **Client** chunein.
4. Apna poora naam, shehar aur address likhein, aur browser ka **location access allow** karein. (Location ke baghair account submit nahi hota.)
5. Account "approval ka intezar" mein chala jata hai. Notification aati hai: *"Account submitted"*.
6. Admin ke approve karte hi notification aati hai: *"Your account is approved"*. Reject ho to wajah dikhti hai; **Settings** mein sahi location de kar dobara check ke liye bhej sakte hain.

### 4.2 Freelancer dhoondna aur hire karna
1. **Find freelancers** kholein.
2. Search karein: naam/skill, shehar, "Verified only", aur radius (default 25 km). Result mein door/qareeb ke freelancers aate hain.
3. **Verified** badge wale profile SkillSpot AI ki profile check pass kar chuke hote hain.
4. Profile kholein, rating, skills, rate aur bio dekhein. Zaroorat ho to **Message** se baat karein.
5. Apne **open gig** par freelancer ko **hire request** bhejein aur apni price likhein (Rs 300 se Rs 1,000,000 ke darmiyan).
6. Request ka jawab **72 ghante** mein na aaye to wo khud expire ho jati hai.

### 4.3 Gig post karna (AI ke saath)
1. **Post a gig** kholein.
2. Apne alfaz mein likhein ke kya kaam chahiye. **AI** usay title, category, skills aur budget ke saath proper job post bana deta hai. Aap edit kar sakte hain.
3. Post karte hi **safety check** chalta hai. Saaf gig foran live ho jata hai. Shak wala gig **"pending review"** mein jata hai, admin dekh kar approve ya reject karta hai.
4. Aap ke open gigs aur unke status **Dashboard** par dikhte hain.

### 4.4 Matches aur AI assistant
- **Matches:** gig ke liye sab se munasib freelancers score ke saath dikhte hain. Score yun banta hai:

  | Cheez | Number |
  |---|---|
  | Skills match | 45 |
  | Location | 20 |
  | Budget | 15 |
  | Experience | 10 |
  | Rating | 10 |

  Jo freelancer pehle se busy ho, uska score 0.6 se multiply ho jata hai. AI sirf "ye kyun fit hai" samjhata hai.
- **Ask SkillSpot AI** (neeche daayen kone ka saffron button): hiring ke sawalon ka assistant.

### 4.5 Hire ka poora process
```
Hire request bhejna ──► Freelancer Accept / Decline
                              │
                         Accept ho gaya
                              ▼
              Client payment karta hai (SkillSpot ke paas "held")
                              ▼
                  Freelancer kaam karta hai, chat hoti hai
                              ▼
        Client "Complete" dabata hai + 1 se 5 rating deta hai
                              ▼
          Paise freelancer ko release (commission aur tax kat kar)
```

| Stage | Matlab |
|---|---|
| `requested` | Request bheji, jawab ka intezar |
| `accepted` | Freelancer ne maan li, kaam chal raha hai |
| `completed` | Kaam mukammal, rating di gayi, paise release |
| `declined` | Freelancer ne mana kar diya |
| `cancelled` | Kisi ne cancel kar diya |
| `expired` | 72 ghante mein jawab nahi aaya |

**Payment kahan se karein:** **My hires** mein accepted job ke card par *"Next step: pay Rs …"* ka panel aata hai. Payment method (Easypaisa, JazzCash, Card, Bank) chunein aur **Pay** dabayein. Payment secure hote hi card par *"Payment secured"* likha aata hai aur **Mark complete & rate** ka button nazar aata hai. Freelancer ko card par intezar ka ya "payment secured" ka paigham dikhta hai.

**Payment ka usool:** paise pehle SkillSpot ke paas **held** hote hain. Jab tak aap kaam se khush ho kar "Complete" nahi dabate, freelancer ko paise nahi milte. **Complete** karne se pehle payment lazmi hai. Kaam cancel ho to held paise **refund** ho jate hain.

> **Test mode:** abhi koi asli paisa nahi chalta. Payment methods (EasyPaisa, JazzCash, card, bank) sirf record hote hain, jab tak asli payment gateway na jura jaye.

### 4.6 Chat
- **Chat** icon se freelancer se private baat karein, live typing aur notifications ke saath.
- **Phone number aur links tab tak chhupe rehte hain** jab tak dono ke darmiyan koi accepted job na ho. Pehle chat mein number likhein to wo `***` ho jata hai.
- Scam jaisa message (advance paise, OTP, CNIC maangna) **bheja hi nahi jata**.
- Shak wale messages admin ko review ke liye flag ho jate hain.

### 4.7 Settings aur safety
- **Settings:** profile, photo, location, blocked users, account deactivate.
- Kisi ko **Block** kar sakte hain.
- Koi profile, gig ya message galat lage to **Report** dabayein (scam, fake gig, harassment, spam…).
- Hamesha paise **SkillSpot ke andar** dein. Kisi ko OTP ya CNIC kabhi na batayein.

### 4.8 Client ki hudood (anti-abuse)
| Hadd | Value |
|---|---|
| Ek waqt mein open gigs | 5 |
| Naye gigs 24 ghante mein | 5 |
| Jawab ke muntazir hire requests | 5 |
| Hire requests ek ghante mein | 20 |
| Naye chats 24 ghante mein | 20 |
| Gig ka budget | Rs 300 – Rs 1,000,000 |
| Chat message | 1000 characters |

---

## 5. Freelancer ke liye guide

![Freelancer guide](docs/freelancer.png)

Freelancer wo hai jo apni skill se kaam karta aur kamata hai.

### 5.1 Account banana
1. Login karein (phone + OTP).
2. **Set up your account** par **Freelancer** chunein.
3. Naam, shehar, address aur location allow karein. Phir admin ke approve karne ka intezar karein (browse kar sakte hain).
4. Freelancer ka interface **neeli (blue) theme** mein hota hai, client ka hara.

### 5.2 Profile mukammal karna
**Profile & settings** mein bharein:
- Asli poora naam (sirf huroof, numbers nahi)
- **Saaf profile photo**
- **Bio** (kam az kam 60 characters) jisme apni main skill ka zikr ho
- **Kam az kam 2 skills**
- Shehar, tajurba (saalon mein), hourly rate (Rs 100 se Rs 20,000)
- Availability (available / busy)

Dashboard par **Profile strength %** dikhta hai. Jitna zyada mukammal, utne zyada hire requests.

### 5.3 Verified badge lena
1. Profile mukammal karke **verification ke liye bhejein**. (Din mein 5 baar tak.)
2. **AI review** profile check karta hai: asli naam, photo, bio ki quality, skills, rate, aur ye ke bio kisi aur ki copy to nahi. 80 ya zyada score aur koi risk na ho to pass.
3. Pass hone par admin dekh kar **Verified** karta hai. Fail ho to wajah likhi aati hai ke kya theek karna hai.
4. Verified badge se clients ka bharosa aur hire hone ke chances barhte hain.
5. Ye ID/CNIC check nahi, sirf profile ki mukammaliyat, quality aur safety ka check hai.

### 5.4 Kaam dhoondna
- **Find jobs:** clients ke open gigs dekhein, shehar aur category se filter karein. Client ko message karke detail pooch sakte hain, ya hire request ka intezar karein.
- **Matches:** aap ki skills, location, rate aur tajurbe se mel khate jobs, score ke saath.
- **Ask SkillSpot AI:** freelancing ke sawalon ka assistant.

### 5.5 Hire request ka jawab dena
1. Nayi request par notification aati hai aur **Job requests** par lal badge dikhta hai.
2. Detail (kaam, price, client ka note) dekh kar **Accept** ya **Decline** karein.
3. **72 ghante** mein jawab na diya to request expire ho jati hai.
4. Accept karte hi:
   - Job **in progress** ho jata hai.
   - Us gig ki baaki requests khud decline ho jati hain.
   - Client ko payment karne ka notification jata hai.
5. Jab client payment kar de, aap ko *"Payment secured"* ka notification milta hai. **Kaam ab shuru karein.** Paise SkillSpot ke paas mehfooz hain.
6. Accept hone ke baad chat mein phone number aur links **ab dikhne lagte hain**, isliye zaroori tafseel share kar sakte hain.

### 5.6 Kaam mukammal hona aur paise milna
Client "Complete" dabata aur rating deta hai, phir paise release hote hain.

**Hisaab ki misaal (Rs 10,000 ka job):**

| Cheez | Rate | Raqam |
|---|---|---|
| Job ki price | | Rs 10,000 |
| SkillSpot commission | 10% | − Rs 1,000 |
| Tax (withholding) | 5% | − Rs 500 |
| **Aap ko milega** | | **Rs 8,500** |

Rates `server/.env` mein `COMMISSION_RATE` aur `TAX_RATE` se badle ja sakte hain. Tax rate ko apne asli qanooni rate ke mutabiq set karein.

Aap ki rating har complete job ke saath update hoti hai.

### 5.7 Cancel karne ke qawaid
- Accept shuda job cancel karna ek **strike** hai.
- **30 din mein 3 strikes** par account **7 din ke liye restricted** ho jata hai.
- Request accept hone se pehle decline karne par koi strike nahi.

### 5.8 Freelancer ki hudood
| Hadd | Value |
|---|---|
| Ek waqt mein live services | 10 |
| Din mein proposals | 20 |
| Naye chats 24 ghante mein | 20 |

---

## 6. Admin ke liye guide

![Admin guide](docs/admin.png)

Admin poore platform ka nigran hai: accounts approve karta, gigs aur reports dekhta, aur paison ka hisaab rakhta hai.

### 6.1 Admin banana aur login
1. `server/.env` mein `ADMIN_EMAIL` aur `ADMIN_PASSWORD` set karein (ya `npm run set-admin-password` chalayein).
2. Server start karein. Admin account khud ban jata hai.
3. `http://localhost:5174/login` kholein, email aur password se login karein.
4. Ghalat password 8 baar daalne par 15 minute ke liye block. Admin session 12 ghante chalta hai.
5. Admin phone OTP se login **nahi** karta.

### 6.2 Admin panel ke 7 tabs

| Tab | Kaam |
|---|---|
| **Overview** | "Needs your attention" ke 5 tiles (approve hone wale accounts, verify hone wale freelancers, review mein gigs, open reports, flagged chats). Tile par click karne se seedha wahan pahunchte hain. Neeche platform stats, paison ka hisaab aur top earners/spenders. |
| **Users** | Search aur filters (role, status, verification). User par click karne se poori detail. |
| **Gigs** | Review mein gigs approve ya remove. |
| **Reports** | Users ki shikayaat par karrwai. |
| **Flagged chats** | Safety rules ke flag kiye messages. |
| **Payments** | Har payment, commission, tax aur "tax paid" ka tracking. |
| **Community** | Clients aur Freelancers ke group chat ki moderation. |

### 6.3 Naye accounts approve karna (sab se zaroori kaam)
1. **Users** tab kholein. Default filter "Waiting for approval" hota hai.
2. User par click karein. Detail mein dekhein:
   - **Location check:** user ne jo shehar likha aur uski GPS location mein kitna farq hai. **60 km se zyada** farq ho to **FLAGGED** dikhta hai.
   - **Risk score** aur wajohat.
   - Bio, skills, tareekh-e-shamooliyat.
3. Faisla karein:
   - **Approve location:** account active.
   - **Approve + verify:** freelancer ko saath hi Verified badge.
   - **Reject:** wajah likhein. User ko wo wajah dikhti hai aur wo Settings se dobara location bhej sakta hai.
4. User ko notification khud chali jati hai.

Approved user agar approve hone ke baad **100 km se zyada** door chala jaye to uska account dobara check ke liye pending ho jata hai.

### 6.4 Freelancers ko verify karna
1. **Users** > filter **"To verify"** (approved aur abhi verified nahi freelancers).
2. Profile dekhein (AI review ka summary maujood hota hai).
3. **Mark verified** dabayein, ya aisa profile ho to **Remove verified** (wajah ke saath).
4. Verified user ko notification milti hai.

### 6.5 User par karrwai
User detail se:

| Action | Asar |
|---|---|
| **Restrict** (1–90 din) | User kuch kaam nahi kar sakta, wajah dikhti hai. **Lift restriction** se hat jati hai. |
| **Ban** | Account band, user logout, uske gigs aur services hata diye jate hain. **Unban** se wapas. |
| **Edit note** | Sirf admins ko nazar aane wala private note. |

Detail mein ye bhi dikhta hai: kitna kharch/kamaya, escrow mein kitna, tax, aur us user ke khilaf aayi reports.

### 6.6 Gigs ki review
1. **Gigs** tab > filter **pending review** (ya Overview ka "Gigs in review" tile).
2. Gig ke saath **safety check** ka summary aur risk score dikhta hai.
3. **Approve:** gig live. **Remove:** wajah likhein; pending proposals aur requests khud khatam, owner ko notification.

### 6.7 Reports sambhalna
1. **Reports** tab kholein (open reports pehle).
2. Report mein reason, reporter, jis par shikayat hai, aur chat ka pichla context dikhta hai.
3. Karrwai chunein:
   - **Dismiss:** shikayat ghalat.
   - **Restrict 7 days:** 7 din ki pabandi.
   - **Remove content:** gig ya community message hata dena.
   - **Ban user:** account band.
4. Ek hi user ki baaki open reports bhi isi faisle par band ho jati hain.

Khud-kaar nizam: **3 alag users** ek hi banday ko report karein to wo **3 din ke liye** khud restrict ho jata hai.

### 6.8 Flagged chats
1. **Flagged chats** tab mein wo messages hain jin par safety rule laga (jaise bahar paise maangna, OTP/CNIC).
2. Dekh kar **Mark reviewed** dabayein. Zaroorat ho to us user par Users tab se karrwai karein.

### 6.9 Paison ka hisaab
- **Overview** mein: escrow mein raqam, released, refunded, freelancers ko diya gaya, commission (mili / baqi), tax (withheld / adaa / baqi), paid jobs.
- **Payments** tab mein har payment ki table: job, client → freelancer, amount, commission, tax, net, status.
- **Tax paid:** jab aap freelancer ka kata hua tax government ko jama kara dein, us payment par "Tax paid" ka checkbox tick karein, taake hisaab saaf rahe.

### 6.10 Community moderation
- **Community** tab mein Clients room aur Freelancers room ke messages dikhte hain.
- Ghalat message par **Delete** (sab ke liye hat jata hai).
- Community mein phone numbers aur links hamesha chhupe rehte hain.

### 6.11 Roz ka admin checklist
1. Overview kholein, "Needs your attention" ke tiles dekhein.
2. Naye accounts approve/reject karein.
3. Review mein gigs dekhein.
4. Open reports aur flagged chats nipta dein.
5. Hafta/mahina: tax paid mark karein aur commission ka hisaab dekhein.

---

## 7. Safety ke khud-kaar qawaid (ek jagah)

| Qaida | Detail |
|---|---|
| Location check | Har naya account admin approve karta hai |
| Gig safety check | Risky gig `pending review` mein jata hai |
| Scam messages | Block (bheje hi nahi jate) |
| Contact chhupana | Phone/links accepted job se pehle `***` |
| Cancel strikes | 30 din mein 3 par 7 din ki pabandi |
| Reports | 3 alag reporters par 3 din ki pabandi |
| Request expiry | 72 ghante |
| Test login | Live par band karna lazmi |

---

## 8. Deploy

- **Server:** Render / Railway par. Saare `.env` variables wahan set karein. `CLIENT_URL` mein client aur admin dono ke asli URLs comma se alag karke likhein.
- **Client:** `cd client && npm run build`, phir Vercel/Netlify par. `/api` aur `/socket.io` ko server ki taraf proxy/rewrite karein.
- **Admin:** `cd admin && npm run build`, alag Vercel/Netlify site par. `/api` ko server ki taraf rewrite karein (admin ko socket nahi chahiye).

**Live karne se pehle:**
- [ ] `ALLOW_TEST_OTP=false`
- [ ] Firebase real OTP chalu
- [ ] Mazboot `JWT_SECRET` aur admin password
- [ ] `.env` aur `firebase-service-account.json` git mein na jayein
- [ ] Asli payment gateway (abhi test mode hai)
- [ ] Tax rate asli qanooni rate par
- [ ] Terms / Privacy pages

---

## 9. Masail aur hal

| Masla | Hal |
|---|---|
| `Cannot reach the server` | Server chal raha hai? `cd server && npm run dev`. |
| Server start hi nahi hota (`Set MONGODB_URI and JWT_SECRET`) | `server/.env` mein dono bharein. |
| `Mongo error` | Atlas ka URI/password check karein, Network Access mein apna IP allow karein. |
| Browser mein CORS error | `CLIENT_URL` mein client aur admin ka sahi URL (http/https aur port samet) likhein, server restart. |
| `Firebase server config missing` | Service account JSON ka path/file sahi rakhein aur server restart. |
| OTP nahi aata | Firebase mein Phone enable, domain authorized, aur Pakistan SMS region blocked na ho. |
| Test OTP `123456` kaam nahi karta | `ALLOW_TEST_OTP=true` hai? (Firebase wale mode mein ye band hona chahiye.) |
| Admin: `Wrong email or password` | `.env` ka `ADMIN_EMAIL` aur password dekhein, ya `npm run set-admin-password` chalayein. |
| Admin: `Too many admin login attempts` | 15 minute intezar. |
| "Your account is waiting for admin approval" | Admin ke approve karne ka intezar, ya admin se kahein ke Users tab dekhe. |
| "Pay for this job in SkillSpot first…" | Client **My hires** mein us job ke card par **Pay** dabaye. Payment ke baad hi **Mark complete & rate** chalta hai. |

---

## 10. Is version ka status (sach batayein)

Server mein ye sab features tayyar hain: **gigs, services, proposals, bookings, payments (test mode), chat, community, reports, AI, admin**.

Client app mein **payment ki screen shamil hai** (My hires ke job card par). Magar in ke screens abhi client mein nahi hain: **services, proposals aur community room**. Server (`/api/services`, `/api/proposals`, `/api/community`) in ke liye tayyar hai.

**Admin panel** ka UI naya design kiya gaya hai aur server ke `/api/admin` routes se judta hai.

---

## 11. Aham commands

| Kaam | Command |
|---|---|
| Server chalana | `cd server && npm run dev` |
| Client chalana | `cd client && npm run dev` |
| Admin chalana | `cd admin && npm run dev` |
| Admin password set | `cd server && npm run set-admin-password` |
| Demo data saaf | `cd server && npm run clear-demo` |
| Client/Admin build | `npm run build` (us folder ke andar) |
