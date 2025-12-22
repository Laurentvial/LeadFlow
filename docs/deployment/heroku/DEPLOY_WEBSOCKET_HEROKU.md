# Déploiement WebSocket sur Heroku

Ce guide explique comment déployer les WebSockets Django Channels sur Heroku.

## Prérequis

1. Application Django avec Channels configuré
2. Compte Heroku
3. Heroku CLI installé

## Étapes de déploiement

### 1. Ajouter l'addon Redis sur Heroku

Heroku nécessite Redis pour les WebSockets. Ajoutez l'addon Redis (gratuit ou payant) :

```bash
# Pour le plan gratuit (limité)
heroku addons:create heroku-redis:mini -a votre-app-name

# Pour le plan payant (recommandé pour la production)
heroku addons:create heroku-redis:premium-0 -a votre-app-name
```

Cela configure automatiquement la variable d'environnement `REDIS_URL` sur votre application.

### 2. Vérifier la configuration

#### Procfile

Le Procfile doit utiliser `daphne` au lieu de `gunicorn` :

```
web: cd backend && daphne -b 0.0.0.0 -p $PORT backend.asgi:application
```

#### Settings.py

La configuration des Channel Layers doit détecter automatiquement `REDIS_URL` :

```python
REDIS_URL = os.getenv('REDIS_URL', None)

if REDIS_URL:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                "hosts": [REDIS_URL],
            },
        },
    }
```

### 3. Vérifier les dépendances

Assurez-vous que `requirements.txt` contient :

```
channels==4.1.0
channels-redis==4.2.0
redis==7.1.0
daphne==4.1.1
```

### 4. Déployer sur Heroku

```bash
# Commit les changements
git add .
git commit -m "Configure WebSocket for Heroku"

# Push vers Heroku
git push heroku main

# Vérifier les logs
heroku logs --tail -a votre-app-name
```

### 5. Vérifier que ça fonctionne

1. Vérifiez les logs Heroku pour confirmer que Daphne démarre :
   ```
   Starting server at tcp:port:XXXXX:interface=0.0.0.0
   ```

2. Testez la connexion WebSocket depuis le frontend

3. Vérifiez que les notifications en temps réel fonctionnent

## Configuration des variables d'environnement

Sur Heroku, configurez également :

```bash
# Allowed hosts (remplacez par votre domaine Heroku)
heroku config:set ALLOWED_HOSTS=votre-app.herokuapp.com -a votre-app-name

# CSRF trusted origins
heroku config:set CSRF_TRUSTED_ORIGINS=https://votre-app.herokuapp.com -a votre-app-name

# USE_REDIS (optionnel, Redis est détecté automatiquement via REDIS_URL)
heroku config:set USE_REDIS=True -a votre-app-name
```

## Dépannage

### Les WebSockets ne se connectent pas

1. Vérifiez que Redis est actif :
   ```bash
   heroku addons -a votre-app-name
   ```

2. Vérifiez les logs :
   ```bash
   heroku logs --tail -a votre-app-name
   ```

3. Vérifiez que `REDIS_URL` est défini :
   ```bash
   heroku config:get REDIS_URL -a votre-app-name
   ```

### Erreur "No channel layer"

- Vérifiez que `REDIS_URL` est bien défini
- Vérifiez que `channels-redis` est dans `requirements.txt`
- Redéployez l'application

### Les notifications ne fonctionnent pas

- Vérifiez que le frontend utilise bien le bon endpoint WebSocket (wss:// pour HTTPS)
- Vérifiez les logs du navigateur (Console) pour les erreurs WebSocket
- Vérifiez que le token JWT est bien passé dans la connexion WebSocket

## Notes importantes

1. **HTTPS/WSS** : Sur Heroku, utilisez `wss://` (WebSocket Secure) au lieu de `ws://` pour les connexions HTTPS.

2. **Redis gratuit** : Le plan gratuit de Heroku Redis a des limitations. Pour la production, utilisez un plan payant.

3. **Dynos** : Assurez-vous d'avoir au moins un dyno web actif :
   ```bash
   heroku ps:scale web=1 -a votre-app-name
   ```

4. **Timeout** : Les connexions WebSocket peuvent timeout après 55 secondes d'inactivité sur Heroku. Le code doit gérer la reconnexion automatique.

## Références

- [Django Channels sur Heroku](https://channels.readthedocs.io/en/stable/deploying.html#deploying-to-heroku)
- [Heroku Redis](https://devcenter.heroku.com/articles/heroku-redis)
- [Daphne Documentation](https://github.com/django/daphne)

