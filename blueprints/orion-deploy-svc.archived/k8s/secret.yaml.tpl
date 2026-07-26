# Secret template - Replace placeholder values with actual secrets
# DO NOT commit real secrets to version control
# Use: kubectl create secret ... or a secret management tool
apiVersion: v1
kind: Secret
metadata:
  name: orion-deploy-secrets
  namespace: orion
type: Opaque
stringData:
  database-url: "<CHANGE_ME>"
