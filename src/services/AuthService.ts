import { PrismaClient } from '@prisma/client';

export class AuthService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Creates an OTP for a user
   * @param userId - The user ID
   * @param otpCode - The OTP code
   * @param expirationMinutes - Minutes until OTP expires (default: 10)
   */
  async createOtp(userId: string, otpCode: string, expirationMinutes: number = 10): Promise<void> {
    // Invalidate any existing unused OTPs for this user
    await this.prisma.otp.updateMany({
      where: {
        userId,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        isUsed: true,
      },
    });

    // Create new OTP
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

    await this.prisma.otp.create({
      data: {
        code: otpCode,
        userId,
        expiresAt,
      },
    });
  }

  /**
   * Verifies an OTP for a user
   * @param userId - The user ID
   * @param otpCode - The OTP code to verify
   * @returns boolean indicating if OTP is valid
   */
  async verifyOtp(userId: string, otpCode: string): Promise<boolean> {
    const otp = await this.prisma.otp.findFirst({
      where: {
        userId,
        code: otpCode,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!otp) {
      return false;
    }

    // Mark OTP as used
    await this.prisma.otp.update({
      where: {
        id: otp.id,
      },
      data: {
        isUsed: true,
      },
    });

    return true;
  }

  /**
   * Cleans up expired OTPs
   */
  async cleanupExpiredOtps(): Promise<void> {
    await this.prisma.otp.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
} 