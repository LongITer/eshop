import React from 'react'

const SuccessPage = () => {
    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50">
            <div className="bg-white p-12 rounded-2xl shadow-lg text-center">
                <h1 className="text-2xl font-semibold mb-4">Welcome back to Eshop</h1>
                <p className="text-gray-600 mb-6">Continue to your seller dashboard to manage your store, products and orders.</p>
                <a
                    href="/dashboard"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                    Go to Dashboard
                </a>
            </div>
        </div>
    )
}

export default SuccessPage
