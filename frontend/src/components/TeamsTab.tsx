import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Eye, Trash2, Plus } from 'lucide-react';
import { useTeams } from '../hooks/useTeams';
import { apiCall } from '../utils/api';
import { CreateTeamDialog } from './CreateTeamDialog';
import { TeamDetailDialog } from './TeamDetailDialog';
import { TeamDetail } from '../types';
import LoadingIndicator from './LoadingIndicator';

export function TeamsTab() {
  const { teams, loading, refetch: refetchTeams } = useTeams();
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);
  const [isTeamDetailOpen, setIsTeamDetailOpen] = useState(false);
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);

  async function viewTeamDetails(teamId: string) {
    try {
      const response = await apiCall(`/api/teams/${teamId}/`);
      setSelectedTeam(response);
      setIsTeamDetailOpen(true);
    } catch (error) {
      console.error('Error loading team details:', error);
    }
  }

  async function handleDeleteTeam(teamId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette équipe ?')) return;
    
    try {
      await apiCall(`/api/teams/${teamId}/delete/`, { method: 'DELETE' });
      refetchTeams();
    } catch (error) {
      console.error('Error deleting team:', error);
    }
  }

  return (
    <>
      <div className="users-teams-action-bar">
        <Button onClick={() => setIsCreateTeamModalOpen(true)}>
          <Plus className="users-teams-icon users-teams-icon-with-margin" />
          Créer une équipe
        </Button>
      </div>

      <CreateTeamDialog
        isOpen={isCreateTeamModalOpen}
        onClose={() => setIsCreateTeamModalOpen(false)}
        onTeamCreated={() => {
          setIsCreateTeamModalOpen(false);
          refetchTeams();
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Liste des équipes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingIndicator />
          ) : teams.length > 0 ? (
            <div className="users-teams-table-container">
              <table className="users-teams-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nom</th>
                    <th>Date de création</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => {
                    let formattedDate = '-';
                    if (team.createdAt) {
                      try {
                        const date = new Date(team.createdAt);
                        if (!isNaN(date.getTime())) {
                          formattedDate = date.toLocaleDateString('fr-FR');
                        }
                      } catch (error) {
                        console.error('Invalid date:', team.createdAt, error);
                      }
                    }
                    
                    return (
                      <tr key={team.id}>
                        <td className="users-teams-table-id">{team.id.substring(0, 8)}</td>
                        <td>{team.name}</td>
                        <td>{formattedDate}</td>
                      <td className="text-right">
                        <div className="users-teams-table-actions">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => viewTeamDetails(team.id)}
                            className="users-teams-view-button"
                            title="Voir l'équipe"
                          >
                            <Eye className="users-teams-icon" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteTeam(team.id)}
                            className="users-teams-delete-button"
                          >
                            <Trash2 className="users-teams-icon" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="users-teams-empty-message">Aucune équipe créée</p>
          )}
        </CardContent>
      </Card>

      <TeamDetailDialog
        team={selectedTeam}
        isOpen={isTeamDetailOpen}
        onOpenChange={setIsTeamDetailOpen}
        onTeamUpdated={() => {
          refetchTeams();
          if (selectedTeam?.team?.id) {
            viewTeamDetails(selectedTeam.team.id);
          }
        }}
      />
    </>
  );
}

