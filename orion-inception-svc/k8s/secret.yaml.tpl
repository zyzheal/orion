# Secret template - Replace placeholder values with actual secrets
# DO NOT commit real secrets to version control
# Use: kubectl create secret ... or a secret management tool
apiVersion: v1
kind: Secret
metadata:
  name: orion-inception-secrets
  namespace: orion
type: Opaque
stringData:
  INCEPTION_PASSWORD: "<CHANGE_ME>"
  NATS_USER: "<CHANGE_ME>"
  NATS_PASS: "<CHANGE_ME>"
