import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@rainbow-me/rainbowkit/styles.css'

import { wagmiConfig } from '@/config/wagmi'
import { connectSocket } from '@/lib/socket'
import { getFheInstance } from '@/lib/fhe'
import { ThemeProvider } from '@/components/ThemeProvider'
import { useTheme } from '@/hooks/useTheme'
import { useLiveRefetch } from '@/hooks/useLiveRefetch'
import App from './App'
import '@/styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <div style={{padding: '20px', color: 'red', background: 'white', zIndex: 9999, position: 'relative'}}>
        <h2>React Error</h2>
        <pre style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{this.state.error.message}</pre>
        <pre style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{this.state.error.stack}</pre>
      </div>;
    }
    return this.props.children;
  }
}

function Root() {
  useEffect(() => {
    connectSocket()
    // Warm up the relayer WASM so the first order encrypts instantly.
    getFheInstance().catch(() => {})
  }, [])
  useLiveRefetch()
  return <ErrorBoundary><App /></ErrorBoundary>
}

function RainbowKitWithTheme({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme()
  const rkTheme = isDark
    ? darkTheme({ accentColor: '#C8102E', accentColorForeground: '#ffffff', borderRadius: 'small', fontStack: 'system' })
    : lightTheme({ accentColor: '#C8102E', accentColorForeground: '#ffffff', borderRadius: 'small', fontStack: 'system' })
  return <RainbowKitProvider theme={rkTheme}>{children}</RainbowKitProvider>
}

const router = createBrowserRouter([
  {
    path: '*',
    element: <Root />,
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <RainbowKitWithTheme>
              <RouterProvider router={router} />
            </RainbowKitWithTheme>
          </ThemeProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
