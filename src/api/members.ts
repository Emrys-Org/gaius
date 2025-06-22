import { PrismaClient } from '@prisma/client';
import { Twilio } from 'twilio';
import { AuthService } from '../services/AuthService';

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize AuthService
const authService = new AuthService(prisma);

// SMS sending function
async function sendSms(to: string, text: string) {
  // Read Twilio credentials from environment variables
  const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
  const authToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
  
  // Check if we're in development mode or if SMS is disabled
  const isDev = import.meta.env.DEV;
  const isSmsEnabled = String(import.meta.env.VITE_ENABLE_SMS) === "true";
  
  // If credentials are missing but we're in dev mode, just mock the SMS sending
  if ((!accountSid || !authToken) && isDev) {
    console.log('MOCK SMS SENDING (Development mode):', { to, text });
    return { success: true, messageId: 'mock-message-id', mock: true };
  }
  
  // If SMS is not enabled, just return success without sending
  if (!isSmsEnabled) {
    console.log('SMS DISABLED:', { to, text });
    return { success: true, messageId: 'disabled', disabled: true };
  }
  
  // If credentials are missing in production, log error
  if (!accountSid || !authToken) {
    console.error("Twilio credentials are not configured");
    throw new Error("Twilio credentials are not configured");
  }
  
  // Proceed with real SMS sending
  const client = new Twilio(accountSid, authToken);

  try {
    const message = await client.messages.create({
      to,
      from: import.meta.env.VITE_TWILIO_PHONE_NUMBER || "+12135148760", // Fallback to hardcoded number if env not set
      body: text,
    });
    console.log("Message sent:", message.sid);
    return { success: true, messageId: message.sid };
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
}

// Member registration interface
export interface MemberRegistrationData {
  walletAddress: string;
  email: string;
  phone: string;
  fullName: string;
  loyaltyProgramId?: string;
}

// OTP verification interface
export interface OTPVerificationData {
  phone: string;
  otpCode: string;
  memberData: MemberRegistrationData;
}

/**
 * Step 1: Register member and send OTP
 */
export async function registerMemberAndSendOTP(memberData: MemberRegistrationData) {
  try {
    // Validate required fields
    if (!memberData.walletAddress || !memberData.email || !memberData.phone || !memberData.fullName) {
      throw new Error('All fields are required');
    }

    // Check if member already exists
    const existingMember = await prisma.member.findFirst({
      where: {
        OR: [
          { walletAddress: memberData.walletAddress },
          { email: memberData.email },
          { phone: memberData.phone }
        ]
      }
    });

    if (existingMember) {
      throw new Error('Member with this wallet address, email, or phone already exists');
    }

    // Find or create user for phone number
    let user = await prisma.user.findUnique({
      where: { phone: memberData.phone }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: memberData.phone,
          email: memberData.email,
          name: memberData.fullName,
        }
      });
    }

    // Generate OTP code - use a fixed code in development for easier testing
    const isDev = import.meta.env.DEV;
    const otp = isDev ? "000000" : Math.floor(100000 + Math.random() * 900000).toString();

    // Send SMS with OTP
    try {
      await sendSms(memberData.phone, `Your Gaius Loyalty OTP is: ${otp}. This code expires in 10 minutes.`);
    } catch (error) {
      console.error("Failed to send SMS:", error);
      // In development, continue even if SMS fails
      if (!isDev) {
        throw new Error("Failed to send verification code. Please try again.");
      } else {
        console.log("Development mode: Continuing despite SMS failure");
      }
    }

    // Store the OTP in database
    await authService.createOtp(user.id, otp);

    // In development, return the OTP for easier testing
    return {
      success: true,
      message: "OTP sent successfully",
      userId: user.id,
      ...(isDev && { otp }) // Only include OTP in development
    };
  } catch (error: any) {
    console.error("Member registration error:", error);
    throw error;
  }
}

/**
 * Step 2: Verify OTP and create member
 */
export async function verifyOTPAndCreateMember(data: OTPVerificationData) {
  try {
    // Find user by phone
    const user = await prisma.user.findUnique({
      where: { phone: data.phone }
    });

    if (!user) {
      throw new Error("User not found. Please request a new verification code.");
    }

    // Verify OTP
    const isValid = await authService.verifyOtp(user.id, data.otpCode);

    if (!isValid) {
      throw new Error("Invalid or expired verification code");
    }

    // Create member
    const member = await prisma.member.create({
      data: {
        walletAddress: data.memberData.walletAddress,
        email: data.memberData.email,
        phone: data.memberData.phone,
        fullName: data.memberData.fullName,
        loyaltyProgramId: data.memberData.loyaltyProgramId,
        isVerified: true,
        userId: user.id,
      }
    });

    return {
      success: true,
      message: "Member registered successfully",
      member
    };
  } catch (error: any) {
    console.error("OTP verification error:", error);
    throw error;
  }
}

/**
 * Get all members for a loyalty program
 */
export async function getMembersByLoyaltyProgram(loyaltyProgramId: string) {
  try {
    const members = await prisma.member.findMany({
      where: {
        loyaltyProgramId,
        isVerified: true
      },
      include: {
        user: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      success: true,
      members
    };
  } catch (error: any) {
    console.error("Error fetching members:", error);
    throw error;
  }
}

/**
 * Get member by wallet address
 */
export async function getMemberByWallet(walletAddress: string) {
  try {
    const member = await prisma.member.findUnique({
      where: { walletAddress },
      include: {
        user: true
      }
    });

    return {
      success: true,
      member
    };
  } catch (error: any) {
    console.error("Error fetching member:", error);
    throw error;
  }
} 