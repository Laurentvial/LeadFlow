import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import '../styles/UsersTeam.css';
import '../styles/PageHeader.css';
import { UsersTab } from './UsersTab';
import { TeamsTab } from './TeamsTab';

export function UsersTeams() {
  return (
    <div className="users-teams-container">
      <div className="page-header-section">
        <h1 className="page-title">Utilisateurs / Équipes</h1>
        <p className="page-subtitle">Gestion des utilisateurs et des équipes</p>
      </div>

      <Tabs defaultValue="users" className="users-teams-tabs">
        <TabsList>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="teams">Équipes</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="users-teams-tab-content">
          <UsersTab />
        </TabsContent>

        <TabsContent value="teams" className="users-teams-tab-content">
          <TeamsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default UsersTeams;