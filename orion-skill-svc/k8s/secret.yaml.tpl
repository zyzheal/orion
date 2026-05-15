apiVersion: v1
kind: Secret
metadata:
  name: orion-skill-svc-secret
  namespace: orion
  labels:
    app: orion-skill-svc
type: Opaque
stringData:
  database.user: "orion_skill_user"
  database.password: "CHANGE_ME_IN_PRODUCTION"
  jwt.secret: "CHANGE_ME_IN_PRODUCTION"