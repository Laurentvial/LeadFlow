import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { X, Eye, EyeOff } from "lucide-react";
import { apiCall } from "../utils/api";
import { toast } from "sonner";
import { formatPhoneNumberAsYouType, removePhoneSpaces } from "../utils/phoneNumber";
import { handleModalOverlayClick } from "../utils/modal";
import { useTeams } from "../hooks/useTeams";
import { useRoles } from "../hooks/useRoles";
import LoadingIndicator from "./LoadingIndicator";
import { Team } from "../types";
import "../styles/Modal.css";

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: () => void;
}

export function CreateUserModal({
  isOpen,
  onClose,
  onUserCreated,
}: CreateUserModalProps) {
  const { teams = [] as Team[], loading: teamsLoading } = useTeams();
  const { roles = [], loading: rolesLoading } = useRoles();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "",
    teamId: "",
    hrex: "",
    requireOtp: false,
  });

  // Set default role when roles are loaded and modal opens
  useEffect(() => {
    if (isOpen && roles.length > 0 && !formData.role) {
      setFormData(prev => ({ ...prev, role: roles[0].id }));
    }
  }, [roles, isOpen]);
  
  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
        role: roles.length > 0 ? roles[0].id : "",
        teamId: "",
        hrex: "",
        requireOtp: false,
      });
    }
  }, [isOpen, roles]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate password match
    if (formData.password !== formData.confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      setLoading(false);
      return;
    }

    // Validate password length
    if (formData.password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      setLoading(false);
      return;
    }

    // Validate email is provided
    if (!formData.email) {
      setError("L'email est requis");
      setLoading(false);
      return;
    }

    try {
      // Map form data to Django API format
      // Use email as username - backend will handle this automatically
      await apiCall("/api/users/create/", {
        method: 'POST',
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone ? removePhoneSpaces(String(formData.phone)) : null,
          roleId: formData.role,
          teamId: formData.teamId || null,
          hrex: formData.hrex || '',
          requireOtp: formData.requireOtp,
        }),
      });

      toast.success("Utilisateur créé avec succès");
      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
        role: roles.length > 0 ? roles[0].id : "",
        teamId: "",
        hrex: "",
        requireOtp: false,
      });
      onClose();
      onUserCreated();
    } catch (err: any) {
      console.error("Create user error:", err);
      const data = err?.response?.data || {};
      const message =
        data.detail ||
        Object.values(data).flat().join(", ") ||
        "Une erreur est survenue lors de la création";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, onClose)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Créer un utilisateur</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="modal-close"
            onClick={onClose}
          >
            <X className="planning-icon-md" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-form-field">
            <Label htmlFor="create-lastName">Nom <span className="text-red-500">*</span></Label>
            <Input
              id="create-lastName"
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              required
            />
          </div>

          <div className="modal-form-field">
            <Label htmlFor="create-firstName">Prénom</Label>
            <Input
              id="create-firstName"
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
            />
          </div>

          <div className="modal-form-field">
            <Label htmlFor="create-email">Email <span className="text-red-500">*</span></Label>
            <Input
              id="create-email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
              placeholder="email@example.com"
            />
          </div>

          <div className="modal-form-field">
            <Label htmlFor="create-phone">Téléphone</Label>
            <Input
              id="create-phone"
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: formatPhoneNumberAsYouType(e.target.value) })
              }
              placeholder="+33 6 12 34 56 78"
            />
          </div>

          <div className="modal-form-field">
            <Label htmlFor="create-password">Mot de passe <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input
                id="create-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
                className="pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-500" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-500" />
                )}
              </Button>
            </div>
          </div>

          <div className="modal-form-field">
            <Label htmlFor="create-confirmPassword">Confirmer le mot de passe <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input
                id="create-confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    confirmPassword: e.target.value,
                  })
                }
                required
                className="pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-500" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-500" />
                )}
              </Button>
            </div>
          </div>

          <div className="modal-form-field">
            <Label htmlFor="create-role">Rôle <span className="text-red-500">*</span></Label>
            <Select
              value={formData.role}
              onValueChange={(value) =>
                setFormData({ ...formData, role: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={rolesLoading ? "Chargement..." : "Sélectionner un rôle"} />
              </SelectTrigger>
              <SelectContent>
                {roles.length > 0 ? (
                  roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-slate-500">
                    {rolesLoading ? "Chargement..." : "Aucun rôle disponible"}
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="modal-form-field">
            <Label htmlFor="create-teamId">Équipe (optionnel)</Label>
            <Select
              value={formData.teamId || "none"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  teamId: value === "none" ? "" : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Aucune équipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune équipe</SelectItem>
                {teams &&
                  teams.length > 0 &&
                  teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="modal-form-field">
            <Label htmlFor="create-hrex">Couleur (optionnel)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="create-hrex"
                type="color"
                value={formData.hrex || '#3B82F6'}
                onChange={(e) => setFormData({ ...formData, hrex: e.target.value })}
                className="w-16 h-10 cursor-pointer"
              />
              <Input
                value={formData.hrex}
                onChange={(e) => setFormData({ ...formData, hrex: e.target.value })}
                placeholder="Ex: #3B82F6 ou blue"
                className="flex-1"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {loading && <LoadingIndicator />}

          <div className="modal-form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Création..." : "Créer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
