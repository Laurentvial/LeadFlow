import React from "react";
import "../styles/NavBar.css";

interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

interface NavbarProps {
  title?: string;
  items?: NavItem[];
}

function Navbar({ title = "Menu", items = [] }: NavbarProps) {
  // Default items if none provided
  const defaultItems: NavItem[] = [
    { label: "Accueil", href: "/" },
    { label: "Notes", href: "#" },
  ];

  const navItems = items.length > 0 ? items : defaultItems;

  return (
    <nav className="navbar">
      <h2 className="navbar-title">{title}</h2>
      <ul className="navbar-list">
        {navItems.map((item, index) => (
          <li key={index} className="navbar-item">
            <a 
              href={item.href} 
              className={`navbar-link ${item.active ? 'active' : ''}`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default Navbar;

