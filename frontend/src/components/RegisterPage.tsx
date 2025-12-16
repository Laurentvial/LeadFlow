import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { signIn } from '../utils/auth';
import { apiCall } from '../utils/api';
import { useUser } from '../contexts/UserContext';
import { Building2 } from 'lucide-react';

export function RegisterPage() {
  const navigate = useNavigate();
  const { refreshUser } = useUser();
  const [signupData, setSignupData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    mobile: '',
    role: 'admin'
  });
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSignupError('');
    setSignupLoading(true);

    if (signupData.password !== signupData.confirmPassword) {
      setSignupError('Les mots de passe ne correspondent pas');
      setSignupLoading(false);
      return;
    }

    if (signupData.password.length < 6) {
      setSignupError('Le mot de passe doit contenir au moins 6 caractères');
      setSignupLoading(false);
      return;
    }

    try {
      // Map signup data to Django API format
      await apiCall('/api/users/create/', {
        method: 'POST',
        body: JSON.stringify({
          username: signupData.username,
          password: signupData.password,
          first_name: signupData.firstName,
          last_name: signupData.lastName,
          role: signupData.role
        })
      });

      // Auto-login after signup
      await signIn(signupData.username, signupData.password);
      await refreshUser();
      navigate('/');
    } catch (err: any) {
      console.error('Signup error:', err);
      setSignupError('Erreur lors de la création du compte. Veuillez réessayer.');
    } finally {
      setSignupLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <CardTitle>LeadFlow</CardTitle>
          <CardDescription>
            Créez votre compte administrateur
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  value={signupData.firstName}
                  onChange={(e) => setSignupData({ ...signupData, firstName: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  value={signupData.lastName}
                  onChange={(e) => setSignupData({ ...signupData, lastName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="username"
                value={signupData.username}
                onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="votre@email.com"
                value={signupData.email}
                onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signup-password">Mot de passe</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={signupData.password}
                  onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={signupData.confirmPassword}
                  onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone (optionnel)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={signupData.phone}
                  onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mobile">Telephone 2 (optionnel)</Label>
                <Input
                  id="mobile"
                  type="tel"
                  value={signupData.mobile}
                  onChange={(e) => setSignupData({ ...signupData, mobile: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rôle</Label>
              <Select value={signupData.role} onValueChange={(value) => setSignupData({ ...signupData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="teamleader">Chef d'équipe</SelectItem>
                  <SelectItem value="gestionnaire">Gestionnaire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {signupError && (
              <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
                {signupError}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={signupLoading}>
              {signupLoading ? 'Création...' : 'Créer mon compte'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-slate-600">
              Vous avez déjà un compte ?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-800 underline">
                Se connecter
              </Link>
            </p>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-slate-600">
            <p>💡 Créez votre premier compte administrateur pour accéder à la plateforme.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RegisterPage;

