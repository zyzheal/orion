# Secret template - Replace placeholder values with actual secrets
# DO NOT commit real secrets to version control
# Use: kubectl create secret ... or a secret management tool
apiVersion: v1
kind: Secret
metadata:
  name: orion-runner-svc-secrets
  namespace: orion
type: Opaque
stringData:
  RUNNER_API_TOKEN: "<CHANGE_ME>"
