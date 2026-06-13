import React, { useState } from 'react';
import { Lock, User, Mail, Eye, EyeOff, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { swalConfig } from '../../lib/sweetAlert';

export function LoginPage() {
  const { signIn, signUp, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
    name: '',
    username: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isSignUp) {
        if (!credentials.name.trim() || !credentials.username.trim()) {
          // Show validation error toast with our styled config
          swalConfig.warning('Missing Information: Name and username are required');
          return;
        }
        await signUp(credentials.email, credentials.password, credentials.name, credentials.username);
      } else {
        await signIn(credentials.email, credentials.password);
      }
    } catch (error: any) {
      // Errors are now handled by the AuthContext with SweetAlert2 toasts
      console.debug('Login error handled by AuthContext:', error.message);
    }
  };

  const resetForm = () => {
    setCredentials({ email: '', password: '', name: '', username: '' });
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    resetForm();
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] dark:bg-[#1f1309] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle coffee atmosphere background */}
      <div className="absolute inset-0 bg-coffee-pattern pointer-events-none" />
      <div className="w-full max-w-md animate-fade-in relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#9a693a] to-[#7a4f2c] rounded-2xl mb-4 shadow-copper">
            <ShoppingCart className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#473b32] dark:text-[#f0ece5] mb-2">CoffeeShop POS</h1>
          <p className="text-[#7d6b57] dark:text-[#c6bbab]">
            {isSignUp ? 'Create your account' : 'Welcome back! Please sign in'}
          </p>
        </div>

        <div className="card p-8 border-0">
          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-[#473b32] dark:text-[#f0ece5] mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#ad9e8a] h-4 w-4" />
                    <input
                      type="text"
                      value={credentials.name}
                      onChange={(e) => setCredentials(prev => ({ ...prev, name: e.target.value }))}
                      className="input pl-10 h-11"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#473b32] dark:text-[#f0ece5] mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#ad9e8a] h-4 w-4" />
                    <input
                      type="text"
                      value={credentials.username}
                      onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                      className="input pl-10 h-11"
                      placeholder="Choose a username"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-semibold text-[#473b32] dark:text-[#f0ece5] mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#ad9e8a] h-4 w-4" />
                <input
                  type="email"
                  value={credentials.email}
                  onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
                  className="input pl-10 h-11"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#473b32] dark:text-[#f0ece5] mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#ad9e8a] h-4 w-4" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="input pl-10 pr-12 h-11"
                  placeholder="Enter your password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#ad9e8a] hover:text-[#7d6b57] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full h-11 font-semibold shadow-md hover:shadow-copper disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{isSignUp ? 'Creating Account...' : 'Signing in...'}</span>
                </>
              ) : (
                <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={toggleMode}
              className="text-sm text-[#9a693a] dark:text-[#cfa16a] hover:text-[#7a4f2c] dark:hover:text-[#ddb889] font-medium"
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"
              }
            </button>
          </div>
          <div className="mt-4 p-4 bg-gradient-to-r from-[#f0ece5] to-[#fcf5eb] dark:from-[#2a1a10] dark:to-[#3b2613] rounded-xl border border-[#ded7cc] dark:border-[#54463b]">
            <p className="text-xs font-bold text-[#473b32] dark:text-[#f0ece5] mb-2 text-center">Need any help?</p>
            <p className="text-xs text-[#7d6b57] dark:text-[#c6bbab] text-center">
              Our team is here to help you!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}