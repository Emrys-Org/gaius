# Gaius Loyalty Program Platform

Gaius is an all-in-one loyalty program platform built on the Algorand blockchain. It allows organizations to create and manage loyalty programs, issue loyalty passes to members, and track member engagement.

## Blockchain-Based Subscription System

The platform uses a blockchain-based subscription system to validate and enforce subscription benefits. Here's how it works:

### Subscription Plans

The platform offers three subscription tiers:

1. **Basic Plan (5 ALGO/month)**
   - Up to 250 members
   - Up to 5 loyalty programs
   - Basic analytics
   - Email support

2. **Professional Plan (20 ALGO/month)**
   - Up to 2,500 members
   - Up to 20 loyalty programs
   - Advanced analytics
   - Priority support
   - Custom branding

3. **Enterprise Plan (50 ALGO/month)**
   - Unlimited members
   - Unlimited loyalty programs
   - Premium analytics
   - Dedicated support
   - Custom branding
   - API access

### How Subscriptions Work

1. **Blockchain Payments**: Subscription payments are made directly on the Algorand blockchain as transactions to a designated wallet address.

2. **Transaction Verification**: Each subscription payment includes metadata that identifies the plan type and organization.

3. **Subscription Validation**: The platform verifies subscription status by checking for valid payment transactions on the blockchain.

4. **Limit Enforcement**: The platform enforces member and program limits based on the active subscription plan.

5. **Subscription Expiry**: Subscriptions are valid for 30 days from the payment transaction timestamp.

### Technical Implementation

- `subscription.ts`: Core utility for subscription verification and management
- Subscription status checks in key components:
  - `LoyaltyProgramMinter`: Enforces program creation limits
  - `LoyaltyPassSender`: Enforces member limits
  - `LoyaltyProgramDashboard`: Displays subscription status and limits

### User Experience

- Clear visual indicators of subscription status and limits
- Upgrade options when limits are reached
- Seamless subscription management within the platform

## Getting Started

1. Connect your Algorand wallet
2. Sign up as an organization admin
3. Choose a subscription plan
4. Start creating loyalty programs and adding members

## Development

This project is built with:
- React
- TypeScript
- Algorand SDK
- Supabase for authentication
- TailwindCSS for styling
