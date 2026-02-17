import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  connectWallet,
  getStoredWalletAddress,
  shortenWalletAddress,
} from '../lib/wallet'

function LoginPage() {
  const navigate = useNavigate()
  const [walletAddress, setWalletAddress] = useState<string | null>(
    getStoredWalletAddress(),
  )
  const [isConnecting, setIsConnecting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleConnectWallet = async () => {
    setErrorMessage(null)
    setIsConnecting(true)

    try {
      const connectedAddress = await connectWallet()
      setWalletAddress(connectedAddress)
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage('Wallet connection failed. Please try again.')
      }
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <section className="login-screen">
      <div className="login-card">
        <h1>Login to paint</h1>
        <p>
          Connect your wallet to unlock painting actions on the global pixel
          canvas.
        </p>

        {walletAddress ? (
          <div className="connected-state">
            Wallet connected: {shortenWalletAddress(walletAddress)}
          </div>
        ) : (
          <button
            type="button"
            className="primary-btn"
            disabled={isConnecting}
            onClick={handleConnectWallet}
          >
            {isConnecting ? 'Connecting wallet...' : 'Connect wallet'}
          </button>
        )}

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

        <div className="login-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => navigate('/')}
          >
            Back to map
          </button>

          {walletAddress ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => navigate('/')}
            >
              Return and paint
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default LoginPage
