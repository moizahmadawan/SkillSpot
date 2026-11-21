# SkillSpot AI — Smart Micro-Gig & Local Skill Finder

SkillSpot AI is a marketplace that helps people find and hire local freelancers, such as electricians, tutors, designers, and developers.

- **Clients** post jobs and hire freelancers.
- **Freelancers** find work and earn money.
- **Admins** manage the platform and help maintain safety.

**Technology Stack:** React, TypeScript, Tailwind CSS, Express.js, MongoDB Atlas, Firebase Phone OTP, Socket.IO, and AI-powered matching using Claude.

---

## 1. Project Structure

```text
skillspot-ai/
├── server/   API (Express + MongoDB + Socket.IO), port 5000
├── client/   User application for clients and freelancers, port 5173
└── admin/    Admin panel, port 5174
```

All three applications run separately. Both `client/` and `admin/` communicate with the same backend through `/api`.

| Application | Users | Authentication |
|---|---|---|
| `client/` | Clients and freelancers | Phone number + OTP |
| `admin/` | Administrators | Email + password |
| `server/` | Backend for both applications | — |

---

## 2. Installation and Setup

### Requirements

- Node.js 18 or later
- MongoDB Atlas account (the free tier is sufficient for development)
- Firebase project (required for real SMS-based phone authentication)

### Step 1: Start the Server

```bash
cd server
cp .env.example .env
npm install
npm run seed
npm run dev
```

If the `.env` file already exists, skip the copy command.

Configure `server/.env` with the following variables:

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string from Database → Connect → Drivers. Allow your IP address under Network Access. |
| `JWT_SECRET` | A long, random secret string of at least 32 characters. |
| `CLIENT_URL` | Client and admin URLs separated by commas, e.g. `http://localhost:5173,http://localhost:5174`. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Administrator email and password. Use a strong password of at least 8 characters. |
| `ALLOW_TEST_OTP` | Set to `true` only for testing with OTP `123456`. Set to `false` in production. |
| `FIREBASE_SERVICE_ACCOUNT_FILE` | Path to the Firebase service account JSON file, e.g. `./firebase-service-account.json`. |
| `ANTHROPIC_API_KEY` | Optional API key for Claude-powered AI features. Rule-based fallback may be available without it. |
| `COMMISSION_RATE` / `TAX_RATE` | Default values: `0.10` and `0.05`, respectively. |

On the first server startup, the console should display a message similar to `Admin login ready: <email>` if the project is configured to initialize the admin account automatically.

To set or change the administrator password:

```bash
cd server
npm run set-admin-password
```

### Step 2: Start the Client Application

Open a new terminal:

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

The client application runs at `http://localhost:5173`.

### Step 3: Start the Admin Panel

Open another terminal:

```bash
cd admin
npm install
npm run dev
```

The admin panel runs at `http://localhost:5174`.

Admin login page: `http://localhost:5174/login`

### Firebase Phone OTP — Real SMS Authentication

1. Open Firebase Console → Authentication → Sign-in method and enable **Phone** authentication.
2. Under Project settings → Your apps, create a Web app.
3. Add the following configuration to `client/.env`:

   ```env
   VITE_USE_FIREBASE=true
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

4. Open Project settings → Service accounts → **Generate new private key**.
5. Save the downloaded JSON file as `server/firebase-service-account.json`. **Never commit this secret file to Git.**
6. Under Authentication → Settings → **Authorized domains**, add your application domain.
7. Set `ALLOW_TEST_OTP=false` in `server/.env`.
8. Restart the server and client applications.

Firebase test phone numbers can also be configured for testing without sending actual SMS messages.

### Testing Without Firebase

For local development, set `VITE_USE_FIREBASE=false` in `client/.env` and `ALLOW_TEST_OTP=true` in the server environment.

Use any phone number and enter OTP `123456`.

**Important:** Never enable test OTP authentication in production.

---

## 3. How the Platform Works

```text
Login using phone OTP
        ↓
Choose Client or Freelancer account type
        ↓
Provide city, address, and location
        ↓
Account waits for administrator approval
        ↓
Admin reviews the location and approves or rejects
        ↓
Approved users can post jobs, hire, chat, and use payment workflows
```

**Important:** Until the administrator approves an account, the user can browse the platform, but posting gigs, hiring, applying, messaging, and payment-related actions remain restricted.

---

## 4. Client Guide

![Client guide](docs/client.png)

A client is someone who needs a service, such as home repairs, tutoring, graphic design, or website development.

### 4.1 Creating an Account

1. Open `http://localhost:5173` and select **Log in**.
2. Enter your phone number, such as `03001234567` or `+923001234567`, and complete OTP verification.
3. On the **Set up your account** screen, select **Client**.
4. Enter your full name, city, and address, and allow browser location access. Location access is required to submit the account.
5. Your account enters the pending-approval state. You should receive an **Account submitted** notification.
6. Once the administrator approves the account, you should receive a **Your account is approved** notification. If rejected, the reason is displayed, and you can correct your location through Settings and resubmit it for review.

### 4.2 Finding and Hiring Freelancers

1. Open **Find freelancers**.
2. Search by name or skill, filter by city, select **Verified only**, and adjust the search radius. The default radius is 25 km.
3. Profiles with the **Verified** badge have passed SkillSpot AI's profile-review process.
4. Open a profile to review the freelancer's rating, skills, hourly rate, and bio. Use **Message** if you need more information.
5. Send a hire request for an open gig and specify your proposed price, between Rs 300 and Rs 1,000,000.
6. If the freelancer does not respond within 72 hours, the request expires automatically.

### 4.3 Posting a Gig with AI

1. Open **Post a gig**.
2. Describe the work in your own words. AI can help generate a structured job post containing a title, category, required skills, and budget. Review and edit the generated information before submission.
3. A safety check runs after submission. Gigs considered safe may be published immediately, while suspicious gigs enter `pending_review` for administrator approval or rejection.
4. View your gigs and their statuses on the Dashboard.

### 4.4 Matching and the AI Assistant

The matching system ranks freelancers according to their suitability for a gig.

| Matching factor | Weight |
|---|---:|
| Skills match | 45 |
| Location | 20 |
| Budget | 15 |
| Experience | 10 |
| Rating | 10 |

A freelancer marked as busy receives a score multiplied by `0.6`. The language model explains why a freelancer may be a good match; it does not replace the underlying scoring system.

**Ask SkillSpot AI:** Use the saffron-colored button in the bottom-right corner to ask questions about hiring and freelancing.

### 4.5 The Hiring Process

```text
Client sends a hire request
        ↓
Freelancer accepts or declines
        ↓
Client pays for the accepted job
        ↓
Payment is recorded as held
        ↓
Freelancer completes the work and communicates through chat
        ↓
Client marks the job complete and submits a rating
        ↓
Payment is released to the freelancer after applicable deductions
```

| Status | Meaning |
|---|---|
| `requested` | Request submitted; awaiting a response |
| `accepted` | Freelancer accepted the job |
| `completed` | Work completed, rating submitted, and payment released |
| `declined` | Freelancer declined the request |
| `cancelled` | The job or request was cancelled |
| `expired` | No response was received within 72 hours |

**How to make a payment:** Open **My hires** and locate the accepted job card. Select the payment option shown in the card, choose a payment method (Easypaisa, JazzCash, card, or bank transfer), and select **Pay**.

After the payment is recorded, the card should display **Payment secured**, and the **Mark complete & rate** button should become available.

**Payment policy:** The intended workflow holds payment until the client confirms completion. However, the current payment methods are in **test mode**. They record payment selections but do not process real money until a payment gateway is integrated.

### 4.6 Chat

- Use the **Chat** icon to communicate privately with freelancers, with live typing indicators and notifications where implemented.
- Phone numbers and links are hidden until an accepted job exists between the users.
- Messages containing suspected scams, such as requests for advance payments, OTPs, or CNIC details, may be blocked.
- Suspicious messages can be flagged for administrator review.

### 4.7 Settings and Safety

- Manage your profile, photo, location, blocked users, and account deactivation through Settings.
- Block users when necessary.
- Report suspicious profiles, gigs, messages, scams, harassment, or spam.
- Use the platform's intended payment workflow, and never share OTPs or CNIC details with other users.

### 4.8 Client Limits

| Limit | Value |
|---|---:|
| Open gigs at one time | 5 |
| New gigs within 24 hours | 5 |
| Pending hire requests | 5 |
| Hire requests per hour | 20 |
| New chats within 24 hours | 20 |
| Gig budget | Rs 300–Rs 1,000,000 |
| Chat message length | 1,000 characters |

---

## 5. Freelancer Guide

![Freelancer guide](docs/freelancer.png)

A freelancer provides services using their skills and earns money by completing jobs.

### 5.1 Creating an Account

1. Log in using your phone number and OTP.
2. Select **Freelancer** on the **Set up your account** screen.
3. Enter your name, city, and address, and allow location access.
4. Wait for administrator approval. You can browse while approval is pending.
5. The freelancer interface uses a blue theme, while the client interface uses a green theme.

### 5.2 Completing Your Profile

Open **Profile & settings** and provide:

- Your full name.
- A clear profile photo.
- A bio of at least 60 characters describing your main skill.
- At least two skills.
- Your city and years of experience.
- An hourly rate between Rs 100 and Rs 20,000.
- Your availability status: available or busy.

The Dashboard displays a **Profile strength** percentage. A more complete profile can help clients evaluate your services.

### 5.3 Getting the Verified Badge

1. Complete your profile and submit it for verification. The system allows up to five submissions per day.
2. The AI review checks profile completeness and quality, including name, photo, bio, skills, rate, and possible copied text.
3. A score of 80 or above with no identified risk may pass the automated review. The administrator makes the final verification decision.
4. If the profile does not pass, review the displayed feedback and correct the relevant information.
5. A Verified badge can help clients assess profile quality.

**Important:** This is a profile-quality and safety review, not an official identity or CNIC verification.

### 5.4 Finding Work

- **Find jobs:** Browse open gigs and filter by city or category.
- **Matches:** Review jobs ranked according to skills, location, rate, and experience.
- **Ask SkillSpot AI:** Ask questions about freelancing and finding work.

You may message clients to clarify details or wait for hire requests, depending on the available workflow.

### 5.5 Responding to Hire Requests

1. New requests trigger a notification and a badge on **Job requests**.
2. Review the job description, proposed price, and client's message.
3. Select **Accept** or **Decline**.
4. Requests expire if unanswered for 72 hours.
5. When you accept a request:
   - The job moves to the in-progress state.
   - Other requests for the same gig are automatically declined.
   - The client receives a payment notification.
6. Once payment is recorded, you receive a **Payment secured** notification.
7. Phone numbers and links become visible in chat after a job is accepted, allowing the parties to exchange necessary details.

### 5.6 Completing Work and Receiving Payment

The client marks the job complete and submits a rating. The system then records the payment release according to the configured commission and tax rates.

**Example: Rs 10,000 job**

| Item | Rate | Amount |
|---|---:|---:|
| Job price | — | Rs 10,000 |
| SkillSpot commission | 10% | − Rs 1,000 |
| Configured withholding tax | 5% | − Rs 500 |
| **Freelancer's net amount** | — | **Rs 8,500** |

Configure `COMMISSION_RATE` and `TAX_RATE` in `server/.env`. Set tax rules according to applicable legal requirements and obtain appropriate professional advice.

The freelancer's rating is updated as completed jobs are recorded.

### 5.7 Cancellation Rules

- Cancelling an accepted job counts as a strike.
- Three strikes within 30 days result in a seven-day account restriction.
- Declining a request before accepting it does not count as a strike.

### 5.8 Freelancer Limits

| Limit | Value |
|---|---:|
| Live services at one time | 10 |
| Proposals per day | 20 |
| New chats within 24 hours | 20 |

---

## 6. Admin Guide

![Admin guide](docs/admin.png)

The administrator oversees the platform, approves accounts, reviews gigs and reports, and monitors payment records.

### 6.1 Creating and Accessing the Admin Account

1. Configure `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `server/.env`, or use the password-setting script.
2. Start the server. If automatic initialization is configured, the admin account is created during startup.
3. Open `http://localhost:5174/login` and sign in with the administrator email and password.
4. The documented login policy blocks access for 15 minutes after eight failed password attempts. The admin session lasts 12 hours.
5. Administrators do not use phone OTP to sign in.

### 6.2 The Seven Admin Tabs

| Tab | Purpose |
|---|---|
| **Overview** | Displays items needing attention, platform statistics, payment summaries, and top earners and spenders. |
| **Users** | Search users and filter by role, status, or verification state. Select a user to view details. |
| **Gigs** | Review, approve, or remove gigs awaiting moderation. |
| **Reports** | Investigate user complaints and take action. |
| **Flagged chats** | Review messages flagged by safety rules. |
| **Payments** | Track payment records, commissions, taxes, and tax-paid status. |
| **Community** | Moderate messages in client and freelancer group chats. |

### 6.3 Approving New Accounts

1. Open **Users**. The default filter shows accounts waiting for approval.
2. Select a user and review:
   - The difference between the entered city and GPS location.
   - The risk score and its associated reasons.
   - The user's bio, skills, and registration date.
3. Choose an action:
   - **Approve location:** Activate the account.
   - **Approve + verify:** Approve the account and verify the freelancer.
   - **Reject:** Provide a reason that the user can review before resubmitting corrected location information.
4. The user receives a notification of the decision.

A difference greater than 60 km between the stated city and GPS location is flagged for review. If an approved user later moves more than 100 km from the approved location, the account may be returned to pending review.

### 6.4 Verifying Freelancers

1. Open **Users** and filter for **To verify**.
2. Review the freelancer's profile and AI-review summary.
3. Select **Mark verified** or **Remove verified**, providing a reason where required.
4. The freelancer receives a notification.

### 6.5 Taking Action on Users

| Action | Effect |
|---|---|
| **Restrict** for 1–90 days | Limits selected user actions and displays the restriction reason. Restrictions can be removed using **Lift restriction**. |
| **Ban** | Disables the account, logs the user out, and removes their gigs and services according to the implemented rules. **Unban** restores access. |
| **Edit note** | Adds a private note visible only to administrators. |

User details may also show earnings, spending, held payments, taxes, and reports associated with the account.

### 6.6 Reviewing Gigs

1. Open **Gigs** and filter for `pending review`, or use the **Gigs in review** tile on the Overview page.
2. Review the gig's safety summary and risk score.
3. Select **Approve** to publish the gig or **Remove** and provide a reason. Removing a gig may close its pending proposals and requests and notify the owner.

### 6.7 Handling Reports

1. Open **Reports** and review open reports first.
2. Check the reason, reporter, reported user, and relevant chat context.
3. Choose an appropriate action:
   - **Dismiss:** Close an unfounded report.
   - **Restrict 7 days:** Restrict the account for seven days.
   - **Remove content:** Remove a gig or community message.
   - **Ban user:** Disable the account.
4. Other open reports against the same user may also be closed as part of the implemented workflow.

The documented automated rule temporarily restricts a user for three days when three distinct users report them. This behavior should be tested carefully before production use.

### 6.8 Reviewing Flagged Chats

1. Open **Flagged chats** to review messages flagged by safety rules, such as requests to exchange money outside the platform or share OTP/CNIC information.
2. Select **Mark reviewed** after reviewing a message.
3. Take further action through the Users tab when necessary.

### 6.9 Monitoring Payments

- The **Overview** page summarizes held, released, and refunded amounts, freelancer payouts, commission, tax, and completed jobs.
- The **Payments** tab displays job, client, freelancer, amount, commission, tax, net amount, and status.
- Mark **Tax paid** only after the relevant tax has actually been remitted to the appropriate authority.

### 6.10 Community Moderation

- The **Community** tab displays messages from the Clients and Freelancers rooms.
- Use **Delete** to remove an inappropriate community message.
- Phone numbers and links are intended to remain hidden in community messages.

### 6.11 Daily Admin Checklist

1. Open Overview and review the **Needs your attention** tiles.
2. Approve or reject pending accounts.
3. Review gigs awaiting moderation.
4. Process open reports and flagged chats.
5. Periodically reconcile tax records and commission totals.

---

## 7. Automated Safety Rules

| Rule | Behavior |
|---|---|
| Location verification | New accounts require administrator approval. |
| Gig safety | Risky gigs enter `pending_review`. |
| Scam messages | Certain suspicious messages may be blocked before sending. |
| Contact privacy | Phone numbers and links are hidden before an accepted job. |
| Cancellation strikes | Three strikes within 30 days can trigger a seven-day restriction. |
| Reports | Three distinct reports may trigger a three-day restriction. |
| Request expiry | Hire requests expire after 72 hours without a response. |
| Test authentication | Must be disabled in production. |

---

## 8. Deployment

- **Server:** Deploy to Render, Railway, or another supported Node.js host. Configure all environment variables, including `CLIENT_URL` with both production client and admin URLs separated by commas.
- **Client:** Run `npm run build` inside `client/` and deploy to Vercel or Netlify. Configure `/api` and `/socket.io` proxying or rewrites to reach the backend.
- **Admin:** Run `npm run build` inside `admin/` and deploy it as a separate site. Configure `/api` rewrites to the backend.

### Production Checklist

- [ ] Set `ALLOW_TEST_OTP=false`.
- [ ] Enable and test real Firebase phone authentication.
- [ ] Use a strong `JWT_SECRET` and administrator password.
- [ ] Ensure `.env` files and `firebase-service-account.json` are excluded from Git.
- [ ] Integrate a real payment gateway; current payment methods are in test mode.
- [ ] Configure the legally applicable tax rules.
- [ ] Publish Terms of Service and Privacy Policy pages.
- [ ] Test authorization, rate limiting, and sensitive API routes.
- [ ] Verify that payment and refund records cannot be manipulated by clients.

---

## 9. Troubleshooting

| Problem | Suggested solution |
|---|---|
| `Cannot reach the server` | Confirm the backend is running with `cd server && npm run dev`. |
| Server reports `Set MONGODB_URI and JWT_SECRET` | Configure both variables in `server/.env`. |
| MongoDB connection error | Check the Atlas connection string, password, and Network Access IP allowlist. |
| Browser CORS error | Set the correct client and admin URLs in `CLIENT_URL`, including protocol and port, then restart the server. |
| Firebase server configuration missing | Check the service account file path and restart the server. |
| OTP does not arrive | Confirm Phone authentication is enabled, the domain is authorized, and the SMS region is supported. |
| Test OTP `123456` fails | Confirm `ALLOW_TEST_OTP=true` and that Firebase authentication is disabled for this test configuration. |
| Admin login reports `Wrong email or password` | Check `ADMIN_EMAIL` and the password, or run `npm run set-admin-password`. |
| Admin reports `Too many admin login attempts` | Wait for the 15-minute lockout to expire. |
| Account is waiting for approval | Ask the administrator to review the account in the Users tab. |
| Payment or completion action is unavailable | Check the job status and whether the client has recorded the required payment step. |

---

## 10. Current Implementation Status

The backend includes functionality for **gigs, services, proposals, bookings, test-mode payments, chat, community, reports, AI features, and administration**.

The client application includes a payment screen accessible from the job card in **My hires**. However, dedicated client screens for **services, proposals, and community rooms** are not currently available, even though the backend has corresponding routes:

- `/api/services`
- `/api/proposals`
- `/api/community`

The admin panel has a redesigned interface connected to the backend's `/api/admin` routes.

**Payment limitation:** Payment methods such as Easypaisa, JazzCash, cards, and bank transfers are currently recorded in test mode. No real funds are transferred until a payment gateway is integrated.

Feature descriptions in this document reflect the supplied project information. Verify each feature against the current code and test environment before presenting it as production-ready.

---

## 11. Useful Commands

| Task | Command |
|---|---|
| Start the server | `cd server && npm run dev` |
| Start the client | `cd client && npm run dev` |
| Start the admin panel | `cd admin && npm run dev` |
| Set admin password | `cd server && npm run set-admin-password` |
| Clear demo data | `cd server && npm run clear-demo` |
| Build client or admin | Run `npm run build` inside the relevant directory |

---

## License

No license has been specified. All rights remain with the respective copyright holders unless a license is added to this repository.
