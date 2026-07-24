# Secret template - Replace placeholder values with actual secrets
# DO NOT commit real secrets to version control
# Use: kubectl create secret ... or a secret management tool
apiVersion: v1
kind: Secret
metadata:
  name: orion-plugin-svc-secrets
  namespace: orion
type: Opaque
stringData:
  DATABASE_URL: "postgresql://<user>:<password>@<host>:5432/<db>"
  API_KEY: "<CHANGE_ME>"
