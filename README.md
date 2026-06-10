##OVERLORD - Full Stack Technical Test
# Démarrer tous les conteneurs
   🚀 Démarrage rapide
         docker-compose up -d

# PDF Publisher - Guide des Interfaces

## Vue d'ensemble

L'application PDF Publisher propose **deux interfaces distinctes** :

| Interface | URL | Accès | Rôle |
|-----------|-----|-------|------|
| **Back Office (Admin)** | http://localhost:5173 | Réservé aux administrateurs | Gestion des documents, upload, modification, publication |
| **Site Public** | http://localhost:3000 | Tout le monde | Consultation des articles publiés |

---

## Interface 1 : Back Office Admin (http://localhost:5173)

## À quoi sert cette interface ?

Le back office est l'interface **réservée aux administrateurs** pour gérer tout le contenu.

## Interface 2 : Site Public (http://localhost:3000)

## À quoi sert cette interface ?

L'interface 2 est le **site public** de votre application PDF Publisher. C'est l'endroit où **les visiteurs, lecteurs et utilisateurs finaux** consultent les articles que vous avez publiés.

## Technologies utilisées 

### Backend (API)

| Technologie | Version | Rôle |
|-------------|---------|------|
| **Node.js** | 22.x | Runtime JavaScript |
| **Express.js** | 4.x | Framework web |
| **Prisma** | 5.x | ORM (accès base de données) |
| **PostgreSQL** | 16 | Base de données relationnelle |
| **OpenAI SDK** | 4.x | Génération IA (titres/résumés) |
| **Anthropic SDK** | 0.x | Alternative IA |
| **Multer** | - | Gestion des uploads de fichiers |

### Frontend (Ops Web)

| Technologie | Version | Rôle |
|-------------|---------|------|
| **Vite** | 5.x | Build tool et dev server |
| **React** | 18.x | Bibliothèque UI |
| **TypeScript** | 5.x | Typage statique |
| **TailwindCSS** | 3.x | Framework CSS |
| **Nginx** | alpine | Serveur web (production) |

### Frontend (Public Web)

| Technologie | Version | Rôle |
|-------------|---------|------|
| **Next.js** | 14.x | Framework React (SSR) |
| **TypeScript** | 5.x | Typage statique |
| **TailwindCSS** | 3.x | Framework CSS |

### Infrastructure

| Technologie | Rôle |
|-------------|------|
| **Docker** | Conteneurisation |
| **Docker Compose** | Orchestration multi-conteneurs |
| **PostgreSQL** | Stockage persistant |

##Les interfaces admin
<img width="1918" height="959" alt="image" src="https://github.com/user-attachments/assets/fc8b0d83-d1da-4a88-8581-418583866947" />
<img width="1919" height="969" alt="image" src="https://github.com/user-attachments/assets/12673aa2-046b-45b5-9037-831e4ba52d4a" />
##Les interfaces Public
<img width="1919" height="972" alt="image" src="https://github.com/user-attachments/assets/bcbf39cd-cd0c-4ecd-930f-74f3c17bf5ac" />
<img width="1919" height="972" alt="image" src="https://github.com/user-attachments/assets/e39a3d73-263f-4a21-b330-ac99170abeb5" />
<img width="1919" height="971" alt="image" src="https://github.com/user-attachments/assets/62a2e7e8-3f1b-4b7a-bec6-21b0dfcb3786" />







