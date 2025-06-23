import { WalletInfo } from './WalletInfo'
import { LoyaltyProgramDashboard } from './LoyaltyProgramDashboard'

const LoyaltyProgram = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <WalletInfo />
      <LoyaltyProgramDashboard />
    </div>
  )
}

export default LoyaltyProgram
