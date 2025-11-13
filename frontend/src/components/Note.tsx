import React from "react";
import "../styles/Note.css"

interface NoteProps {
  note: { id: string; text: string; createdAt?: string; created_at?: string };
  onDelete: (id: string) => void;
}

const Note: React.FC<NoteProps> = ({ note, onDelete }) => {
    const dateStr = note.createdAt || note.created_at || new Date().toISOString();
    const formattedDate = new Date(dateStr).toLocaleDateString("fr-FR");
    return (
    <div className="note-container">
      <p className="note-text">{note.text}</p>
      <p className="note-date">
        {formattedDate}
      </p>
      <button className="note-delete-button" onClick={() => onDelete(note.id)}>
        Delete
      </button>
    </div>
  );
};

export default Note;
