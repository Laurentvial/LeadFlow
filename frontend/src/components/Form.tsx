import React, { useState } from 'react';
import { apiCall } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../utils/constants';
import { Label } from './ui/label';
import '../styles/Form.css';
import LoadingIndicator from './LoadingIndicator';
import { toast } from 'sonner';

interface FormProps {
  route: string;
  method: 'login';
  onSuccess?: () => void;
}

function Form({ route, method, onSuccess }: FormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const name = 'Connexion';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = { username, password };

      const response = await apiCall(route, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (onSuccess) {
        onSuccess();
      } else {
        localStorage.setItem(ACCESS_TOKEN, response.access);
        localStorage.setItem(REFRESH_TOKEN, response.refresh);
        navigate('/');
      }
    } catch (error: any) {
      const data = error?.response || {};
      const message = data.detail || data.error || error?.message || 'Une erreur est survenue';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-container">
      <h1>{name}</h1>
      <div className="form-field">
        <Label>Username</Label>
        <input
          className="form-input"
          onChange={(e) => setUsername(e.target.value)}
          value={username}
          type="text"
          name="username"
          placeholder="Username"
          required
        />
      </div>
      <div className="form-field">
        <Label>Password</Label>
        <input
          className="form-input"
          onChange={(e) => setPassword(e.target.value)}
          value={password}
          type="password"
          name="password"
          placeholder="Password"
          required
        />
      </div>
      {loading && <LoadingIndicator />}
      <button className="form-button" type="submit">
        {name}
      </button>
    </form>
  );
}
export default Form;