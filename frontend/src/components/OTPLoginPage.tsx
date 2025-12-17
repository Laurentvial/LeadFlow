import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { sendOTP, verifyOTP } from '../utils/auth';
import { useUser } from '../contexts/UserContext';
import { toast } from 'sonner';
import '../styles/LoginPage.css';

export function OTPLoginPage() {
  const navigate = useNavigate();
  const { refreshUser } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'password' | 'otp'>('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [countdown, setCountdown] = useState(0);

  async function handleSendOTP(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSendingOTP(true);

    try {
      await sendOTP(email, password);
      toast.success('OTP code sent to your email');
      setStep('otp');
      setCountdown(60); // 60 second countdown
      
      // Start countdown timer
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Send OTP error:', err);
      const errorMessage = err?.message || 'Failed to send OTP code';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSendingOTP(false);
    }
  }

  async function handleVerifyOTP(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await verifyOTP(email, otp);
      await refreshUser();
      toast.success('Login successful');
      navigate('/');
    } catch (err: any) {
      console.error('Verify OTP error:', err);
      const errorMessage = err?.message || 'Invalid OTP code';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function handleResendOTP() {
    if (countdown > 0) return;
    
    setError('');
    setSendingOTP(true);

    sendOTP(email, password)
      .then(() => {
        toast.success('OTP code resent to your email');
        setCountdown(60);
        
        // Start countdown timer
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      })
      .catch((err: any) => {
        const errorMessage = err?.message || 'Failed to resend OTP code';
        setError(errorMessage);
        toast.error(errorMessage);
      })
      .finally(() => {
        setSendingOTP(false);
      });
  }

  return (
    <div className="login-page-container">
      <Card className="login-card">
        <CardHeader className="login-card-header">
          <CardTitle>
            <div className="login-logo-container">
              <img src="/images/logo-w.png" alt="Logo" className="" style={{ maxHeight: 100, maxWidth: 140 }} />
            </div>
          </CardTitle>
          <CardDescription>
            {step === 'password' ? 'Enter your email and password to receive OTP' : 'Enter the OTP code sent to your email'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'password' ? (
            <form onSubmit={handleSendOTP} className="login-form">
              <div className="login-form-field">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="login-form-field">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="login-error">
                  {error}
                </div>
              )}

              <Button type="submit" className="login-button" disabled={sendingOTP}>
                {sendingOTP ? 'Sending OTP...' : 'Send OTP'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="login-form">
              <div className="login-form-field">
                <Label htmlFor="email-display">Email</Label>
                <Input
                  id="email-display"
                  type="email"
                  value={email}
                  disabled
                  className="opacity-60"
                />
              </div>

              <div className="login-form-field">
                <Label htmlFor="otp">OTP Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  required
                  style={{ letterSpacing: '8px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}
                />
              </div>

              {error && (
                <div className="login-error">
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <Button type="submit" className="login-button" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </Button>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setStep('password');
                      setOtp('');
                      setError('');
                      setCountdown(0);
                    }}
                    disabled={loading}
                  >
                    Back
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResendOTP}
                    disabled={sendingOTP || countdown > 0}
                  >
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                  </Button>
                </div>
              </div>
            </form>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

export default OTPLoginPage;
