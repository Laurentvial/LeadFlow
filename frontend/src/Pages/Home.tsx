import React from "react";
import { useState, useEffect } from "react";
import { apiCall } from "../utils/api";
import Note from "../components/Note";
import "../styles/NoteStyles.css";
import { Dashboard } from "../components/Dashboard";
import { useUser } from "../contexts/UserContext";
import { toast } from "sonner";


function Home() {
  const [notes, setNotes] = useState([]);
  const [content, setContent] = useState("");
  const { currentUser } = useUser();
  
  useEffect(() => {
    getNotes();
  }, []);
  
  const getNotes = async () => {
    try {
      const data = await apiCall("/api/notes/");
      setNotes(Array.isArray(data) ? data : data?.notes || []);
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors du chargement des notes');
    }
  };

  const deleteNote = async (id: string) => {
    if (!id) {
      toast.error("Erreur: ID de la note manquant");
      return;
    }
    try {
      await apiCall(`/api/notes/delete/${id}/`, { method: 'DELETE' });
      toast.success("Note supprimée avec succès");
      getNotes();
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la suppression');
    }
  };

  const createNote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiCall("/api/notes/create/", {
        method: 'POST',
        body: JSON.stringify({ text: content }),
      });
      toast.success("Note créée avec succès");
      getNotes();
      setContent("");
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la création');
    }
  };

  return (
    <div>
      <Dashboard user={currentUser} />
      <div style={{ padding: "40px 0px" }}>
        <div>
          <h1>Notes</h1>
          {notes.map((note: any) => (
            <Note key={note.id} note={note} onDelete={deleteNote} />
          ))}
        </div>
        <div>
          <h2>Créer une note</h2>
          <form onSubmit={createNote} className="form-container">
            <label htmlFor="content">Contenu</label>
            <textarea id="content" name="content" required value={content} onChange={(e) => setContent(e.target.value)} />
            <input type="submit" value="Créer"></input>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Home;
