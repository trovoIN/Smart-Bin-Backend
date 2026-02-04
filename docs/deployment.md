# Smart Bin Backend - Deployment Guide

This guide covers deployment instructions for the Smart Bin Backend on various platforms.

## 🚀 Live Environment (Current)
- **Status**: Live
- **URL**: [https://smart-bin-backend-bvo8.onrender.com](https://smart-bin-backend-bvo8.onrender.com)
- **Branch**: `master`

---

## ⚡ Option 1: Vercel (Recommended for Next.js)

Vercel is the native platform for Next.js and offers the best performance and easiest setup.

### Steps:
1. **GitHub Integration**:
   - Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
   - Import the `Smart-Bin-Backend` repository.
2. **Project Settings**:
   - **Framework Preset**: Next.js (Auto-detected).
   - **Root Directory**: `./` (Default).
3. **Environment Variables**:
   Add the following variables in the Vercel dashboard:
   - `DATABASE_URL`: Your Prisma connection string.
   - `JWT_SECRET`: A secure random string.
   - `SUPABASE_URL` / `SUPABASE_KEY`: (If using Supabase).
4. **Deploy**:
   - Click **"Deploy"**. Vercel will automatically run `npm run build` and handle Prisma generation.

> [!NOTE]
> Vercel automatically handles the `NODE_ENV=production` setting and build caching.

---

## 🐳 Option 2: Docker/VPS (Self-Hosting)

If you want to host on a private server (DigitalOcean, AWS EC2, etc.).

### Steps:
1. **Create a Dockerfile**:
   You can add a `Dockerfile` to the root of your project:
   ```dockerfile
   FROM node:22-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   RUN npx prisma generate
   RUN npm run build
   EXPOSE 3000
   CMD ["npm", "start"]
   ```
2. **Setup DB**:
   Ensure your production database is accessible from your VPS.
3. **Run**:
   ```bash
   docker build -t smart-bin-backend .
   docker run -p 3000:3000 --env-file .env smart-bin-backend
   ```

---

## ☁️ Option 3: AWS Amplify / App Runner

AWS provides managed services for Next.js.

### Steps:
1. **AWS Amplify**:
   - Connect your GitHub repo.
   - Amplify will recognize the Next.js app.
   - In the "Build Settings", ensure it runs `npx prisma generate` before `next build`.
2. **Environment Variables**:
   - Set them in the Amplify "Service Settings" -> "Environment Variables".

---

## 🏢 Admin Dashboard & 🏠 Household App
**Location**: `ghmc admin dashboard 1/` and `household web app 1/`
**Tech**: Vite + React + TypeScript

These are standard web applications. The simplest way to deploy is using **Vercel** or **Render Static Sites**.

### Steps for Vercel:
1. Push each folder to GitHub (as separate repos or a monorepo).
2. Create a new project on Vercel and select the folder.
3. **Environment Variables**:
   - `VITE_API_URL`: Set this to your live backend URL (e.g., `https://smart-bin-backend-bvo8.onrender.com`).
4. **Build Command**: `npm run build`
5. **Output Directory**: `dist`

---

## 📱 Collector Mobile App
**Location**: `Collector/`
**Tech**: Expo (React Native)

Since this is a mobile app, it needs to be built for Android/iOS or run via Expo Go.

### 1. Development / Testing:
- Install the **Expo Go** app on your phone.
- Run `npx expo start` in the `Collector/` directory.
- Scan the QR code with your phone to test.

### 2. Production Build (Android/iOS):
You should use **EAS Build** (Expo's cloud build service):
1. Install EAS CLI: `npm install -g eas-cli`.
2. Login: `eas login`.
3. Configure: `eas build:configure`.
4. Build for Android (APK): `eas build -p android --profile preview`.
5. Build for iOS: `eas build -p ios`.

> [!IMPORTANT]
> Change the API URL in `Collector/api/` or whichever file handles the base URL to point to your live backend BEFORE building.

---

## 📋 Pre-Deployment Checklist
- [x] Backend is live at Render.
- [ ] Frontend `VITE_API_URL` updated to point to live backend.
- [ ] Mobile app API base URL updated.
- [ ] `JWT_SECRET` matches across all components.
