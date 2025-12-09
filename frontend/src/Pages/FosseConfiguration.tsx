import React from 'react';
import { FosseSettingsTab } from '../components/FosseSettingsTab';
import '../styles/UsersTeam.css';
import '../styles/PageHeader.css';

export function FosseConfiguration() {
  return (
    <div className="users-teams-container">
      <div className="page-header-section">
        <h1 className="page-title">Configuration de la fosse</h1>
        <p className="page-subtitle">Gestion des paramètres de la page Fosse</p>
      </div>
      <FosseSettingsTab />
    </div>
  );
}

export default FosseConfiguration;

