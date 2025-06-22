# Member Registration System Setup

This guide will help you set up the member registration system with OTP verification for your Gaius Loyalty Platform.

## Overview

The member registration system allows you to:
- Create shareable registration forms for your loyalty programs
- Verify members via SMS OTP using Twilio
- Store member data in a PostgreSQL database using Prisma
- Issue NFT loyalty passes to verified members

## Prerequisites

Before setting up the member registration system, ensure you have:
- Node.js and npm/pnpm installed
- PostgreSQL database (local or cloud)
- Twilio account for SMS verification
- Pinata account for IPFS storage (already configured)

## Installation Steps

### 1. Install Required Dependencies

```bash
npm install @prisma/client prisma twilio zod
# or
pnpm add @prisma/client prisma twilio zod
```

### 2. Database Setup

#### Configure Environment Variables

Copy the `env.example` file to `.env` and update the following variables:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/gaius_loyalty?schema=public"

# Twilio Configuration (for SMS OTP)
VITE_TWILIO_ACCOUNT_SID="your_twilio_account_sid"
VITE_TWILIO_AUTH_TOKEN="your_twilio_auth_token"
VITE_TWILIO_PHONE_NUMBER="+1234567890"
VITE_ENABLE_SMS="true"
```

#### Initialize Prisma

```bash
# Generate Prisma client
npx prisma generate

# Push the schema to your database
npx prisma db push

# (Optional) Open Prisma Studio to view your database
npx prisma studio
```

### 3. Twilio Configuration

1. Sign up for a [Twilio account](https://www.twilio.com/try-twilio)
2. Get your Account SID and Auth Token from the Twilio Console
3. Purchase a phone number for sending SMS
4. Update your `.env` file with these credentials

### 4. Database Configuration

#### Option A: Local PostgreSQL
1. Install PostgreSQL locally
2. Create a database named `gaius_loyalty`
3. Update the `DATABASE_URL` in your `.env` file

#### Option B: Cloud Database (Recommended)
Use a cloud provider like:
- [Supabase](https://supabase.com/) (Free tier available)
- [PlanetScale](https://planetscale.com/) (MySQL compatible)
- [Railway](https://railway.app/) (PostgreSQL)
- [Neon](https://neon.tech/) (PostgreSQL)

## Usage

### 1. Creating Shareable Registration Links

1. Navigate to the Organization Dashboard
2. Go to the "Programs" tab
3. Click "Share Registration Link" on any loyalty program
4. Copy the generated link and share it with potential members

### 2. Manual Member Registration

1. Go to the "Add Member" tab in the Organization Dashboard
2. Select a loyalty program
3. Fill out the member registration form
4. The member will receive an OTP via SMS
5. After verification, the member will be added to your program

### 3. Managing Members

1. View all members in the "Members" tab
2. Issue NFT loyalty passes to verified members
3. Export member data for external use

## API Structure

The member registration system includes:

### Database Models
- `User`: Stores user authentication data (phone, email)
- `Member`: Stores member profile and loyalty program association
- `Otp`: Manages OTP codes for phone verification

### API Functions
- `registerMemberAndSendOTP()`: Initiates registration and sends OTP
- `verifyOTPAndCreateMember()`: Verifies OTP and creates member
- `getMembersByLoyaltyProgram()`: Retrieves members for a program
- `getMemberByWallet()`: Finds member by wallet address

## Development Mode

In development mode:
- OTP is set to `000000` for easy testing
- SMS sending is mocked (check console logs)
- Database operations are still functional

## Security Features

- Phone number verification via SMS OTP
- Unique wallet address validation
- Secure database storage with Prisma
- Environment variable protection for API keys
- Blockchain-secured membership records

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify your `DATABASE_URL` is correct
   - Ensure your database is running
   - Check network connectivity

2. **SMS Not Sending**
   - Verify Twilio credentials in `.env`
   - Check phone number format (include country code)
   - Ensure `VITE_ENABLE_SMS` is set to "true"

3. **OTP Verification Failed**
   - Check if OTP has expired (10-minute limit)
   - Verify the phone number matches exactly
   - In development, use OTP `000000`

### Development Tips

1. Use Prisma Studio to inspect your database:
   ```bash
   npx prisma studio
   ```

2. Reset your database schema:
   ```bash
   npx prisma db push --force-reset
   ```

3. View console logs for SMS mock messages in development

## Production Deployment

For production deployment:

1. Set `NODE_ENV="production"` in your environment
2. Use a production PostgreSQL database
3. Configure proper Twilio credentials
4. Enable SSL for database connections
5. Set up proper error logging and monitoring

## Support

If you encounter issues:
1. Check the console for error messages
2. Verify all environment variables are set correctly
3. Ensure your database is accessible
4. Test Twilio credentials with their API explorer
5. Review the Prisma schema for any conflicts

## Next Steps

After setting up the member registration system, you can:
- Customize the registration form UI
- Add email verification alongside SMS
- Implement member tiers and point systems
- Create automated loyalty pass distribution
- Add analytics and reporting features 