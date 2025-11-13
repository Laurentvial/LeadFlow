import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { signIn } from '../utils/auth';
import { useUser } from '../contexts/UserContext';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import '../styles/LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const { refreshUser } = useUser();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(username, password);
      await refreshUser();
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      
      // Extract error message - signIn throws Error objects, not axios errors
      let errorMessage = 'Username ou mot de passe incorrect.';
      
      if (err?.message) {
        errorMessage = err.message;
      } else if (err?.response?.data) {
        // Fallback for axios-style errors if signIn changes
        const data = err.response.data;
        errorMessage = data.detail || Object.values(data).flat().join(', ') || errorMessage;
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page-container">
      <Card className="login-card">
        <CardHeader className="login-card-header">

          <CardTitle>Panorama</CardTitle>
          <CardDescription>
            Connectez-vous à votre compte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-form-field">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="login-form-field">
              <Label htmlFor="password">Mot de passe</Label>
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

            <Button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>


        </CardContent>
      </Card>
    </div>
  );
}

export default LoginPage;