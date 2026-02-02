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

## 📋 Pre-Deployment Checklist
- [ ] Ensure `DATABASE_URL` is a production-ready database (e.g., Supabase PostgreSQL).
- [ ] Verify `JWT_SECRET` is unique and secure.
- [ ] Check `next.config.ts` for CORS settings allowing your frontend domain.
- [ ] Run `npx prisma migrate deploy` on the production database to sync the schema.
