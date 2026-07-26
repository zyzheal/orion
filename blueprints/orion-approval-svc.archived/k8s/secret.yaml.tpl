# Secret template - Replace placeholder values with actual secrets
# DO NOT commit real secrets to version control
# Use: kubectl create secret ... or a secret management tool
apiVersion: v1
kind: Secret
metadata:
  name: orion-approval-secrets
  namespace: orion
type: Opaque
stringData:
  DB_USER: "<CHANGE_ME>"
  DB_PASSWORD: "<CHANGE_ME>"
