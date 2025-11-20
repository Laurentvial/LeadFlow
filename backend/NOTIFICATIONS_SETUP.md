# Système de Notifications en Temps Réel

## Vue d'ensemble

Ce projet utilise **Django Channels** avec **WebSockets** pour fournir des notifications en temps réel. Cette solution est intégrée directement dans le backend Django, sans besoin d'un projet séparé.

## Architecture

### Backend (Django Channels)

1. **ASGI Configuration** (`backend/asgi.py`)
   - Configuration pour gérer les connexions WebSocket
   - Authentification via JWT token

2. **Consommateurs WebSocket** (`backend/api/consumers.py`)
   - `NotificationConsumer`: Gère les notifications en temps réel
   - `ChatConsumer`: Gère les messages de chat en temps réel

3. **Modèle Notification** (`backend/api/models.py`)
   - Supporte différents types de notifications (message, email, contact, event, system)
   - Stocke les données supplémentaires en JSON
   - Suivi du statut de lecture

4. **Endpoints API** (`backend/api/views.py`)
   - `GET /api/notifications/`: Liste des notifications
   - `GET /api/notifications/unread-count/`: Nombre de notifications non lues
   - `POST /api/notifications/{id}/read/`: Marquer une notification comme lue
   - `POST /api/notifications/mark-all-read/`: Marquer toutes comme lues

### Frontend (React)

1. **Hook useWebSocket** (`frontend/src/hooks/useWebSocket.ts`)
   - Gère les connexions WebSocket
   - Reconnexion automatique
   - Authentification via token JWT

2. **Composant Notifications** (`frontend/src/components/Notifications.tsx`)
   - Affiche les notifications en temps réel
   - Badge avec compteur de non lues
   - Intégré dans le Header

3. **Composant Chat** (`frontend/src/components/Chat.tsx`)
   - Utilise WebSockets pour les messages en temps réel
   - Remplace le polling précédent (3-5 secondes)

## Installation

### 1. Installer les dépendances

```bash
cd backend
pip install -r requirements.txt
```

Les packages suivants sont ajoutés :
- `channels==4.1.0`
- `channels-redis==4.2.0`

### 2. Configuration Redis (Production)

Pour la production, configurez Redis :

```bash
# Variables d'environnement
REDIS_HOST=your-redis-host
REDIS_PORT=6379
USE_REDIS=True
```

Pour le développement local, le système utilise un channel layer en mémoire (pas besoin de Redis).

### 3. Migrations

```bash
python manage.py migrate
```

### 4. Déploiement

#### Heroku

1. Ajoutez Redis via Heroku Add-ons :
```bash
heroku addons:create heroku-redis:mini
```

2. Configurez les variables d'environnement :
```bash
heroku config:set USE_REDIS=True
heroku config:set REDIS_URL=$(heroku config:get REDIS_URL)
```

3. Mettez à jour le Procfile pour utiliser ASGI :
```
web: daphne backend.asgi:application --port $PORT --bind 0.0.0.0
```

Ou utilisez gunicorn avec daphne :
```
web: daphne -b 0.0.0.0 -p $PORT backend.asgi:application
```

## Utilisation

### Créer une notification depuis le backend

```python
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from api.models import Notification
import uuid

# Créer la notification dans la base de données
notification = Notification.objects.create(
    id=uuid.uuid4().hex[:12],
    user=target_user,
    type='message',
    title='Nouveau message',
    message='Vous avez reçu un nouveau message',
    message_id=message.id,
    data={'chat_room_id': chat_room.id}
)

# Envoyer via WebSocket
channel_layer = get_channel_layer()
if channel_layer:
    async_to_sync(channel_layer.group_send)(
        f'notifications_{target_user.id}',
        {
            'type': 'send_notification',
            'notification': {
                'id': notification.id,
                'type': notification.type,
                'title': notification.title,
                'message': notification.message,
                'is_read': notification.is_read,
                'created_at': notification.created_at.isoformat(),
            },
            'unread_count': Notification.objects.filter(
                user=target_user, 
                is_read=False
            ).count()
        }
    )
```

### Utiliser WebSocket dans le frontend

```typescript
import { useWebSocket } from '../hooks/useWebSocket';

const ws = useWebSocket({
  url: '/ws/notifications/',
  onMessage: (message) => {
    if (message.type === 'notification') {
      // Traiter la notification
      console.log('Nouvelle notification:', message.notification);
    }
  },
  reconnect: true,
});

// Envoyer un message
ws.send({ type: 'mark_read', notification_id: '123' });
```

## Types de notifications

- `message`: Nouveau message de chat
- `email`: Nouvel email reçu
- `contact`: Contact mis à jour
- `event`: Nouvel événement
- `system`: Notification système

## Avantages de cette solution

1. **Temps réel instantané** : Pas de délai de polling
2. **Moins de charge serveur** : Pas de requêtes répétées toutes les secondes
3. **Intégration native** : Tout dans le même projet Django
4. **Évolutif** : Supporte Redis pour la production
5. **Reconnexion automatique** : Gestion des déconnexions réseau

## Dépannage

### WebSocket ne se connecte pas

1. Vérifiez que le token JWT est valide
2. Vérifiez les CORS settings dans `settings.py`
3. Vérifiez que ASGI est bien configuré

### Notifications ne s'affichent pas

1. Vérifiez la console du navigateur pour les erreurs WebSocket
2. Vérifiez que Redis est configuré en production
3. Vérifiez que les migrations sont appliquées

### Performance

- En développement : Utilise le channel layer en mémoire (pas de Redis nécessaire)
- En production : Utilise Redis pour la scalabilité

## Notes importantes

- Les WebSockets utilisent le même système d'authentification JWT que l'API REST
- Le système de notifications est automatiquement intégré au chat
- Les notifications sont persistées en base de données pour l'historique

