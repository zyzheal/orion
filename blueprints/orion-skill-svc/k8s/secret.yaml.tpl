# Secret template - Replace placeholder values with actual secrets
# DO NOT commit real secrets to version control
apiVersion: v1
kind: Secret
metadata:
  name: orion-skill-svc-secret
  namespace: orion
  labels:
    app: orion-skill-svc
type: Opaque
stringData:
  database.user: "<CHANGE_ME>"
  database.password: "<CHANGE_ME>"
  jwt.secret: "<CHANGE_ME>"