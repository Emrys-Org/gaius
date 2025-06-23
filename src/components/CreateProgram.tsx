import React from 'react'
import { Link, redirect } from 'react-router'
import { WalletInfo } from './WalletInfo'
import { LoyaltyProgramMinter } from './LoyaltyProgramMinter'

const CreateProgram = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <button className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            ← Back to Home
          </button>
        </Link>
      </div>
      <WalletInfo />
      <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 my-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Create Your Loyalty Program</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Network:
            </span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                activeNetwork === 'mainnet'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
              }`}
            >
              {activeNetwork === 'mainnet' ? 'MainNet' : 'TestNet'}
            </span>
          </div>
        </div>
        <LoyaltyProgramMinter
          onLoyaltyProgramMinted={() => redirect('/loyalty-dashboard')}
        />
      </div>
    </div>
  )
}

export default CreateProgram
